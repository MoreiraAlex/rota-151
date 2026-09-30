"""Converte um Pokémon do dump do Legends (formato Switch/Trinity) em um .glb pronto para o jogo.

Roda em modo headless, com o addon Pokemon-Switch-Model-Importer-Blender instalado:

  blender --background --python scripts/blender/convert-pokemon.py -- \
      --dex 4 --src <RawAssets/Legends> --out <public/assets/new>

Saída:
  <out>/models/<dex>-<nome>.glb            modelo + rig + animações (sem texturas embutidas)
  <out>/textures/<dex>-<nome>/default/*.png  cor final assada (bake) do shader do addon

As texturas ficam fora do .glb de propósito: o jogo aplica a variante (default, shiny...)
pelo nome do material (body, eye, fire), então o mesmo .glb serve para todas.
"""
import bpy, os, sys, addon_utils

ADDON = "Pokemon-Switch-Model-Importer-Blender-main"

# nome no jogo -> nome do arquivo no Legends (sem o prefixo pmXXXX_00_00_ e sem a extensão).
# O prefixo numérico é o estado de locomoção (0xxxx terrestre, 1xxxx água, 2xxxx voo);
# o script tenta o estado pedido e cai para o terrestre se não achar.
ANIMATIONS = {
    "idle": "00000_defaultwait01_loop", "idleAlt": "00010_defaultidle01",
    "battleIdle": "00001_battlewait01_loop", "battleIdleAlt": "00012_battleidle02",
    "walk": "00030_walk01_loop", "run": "00100_run01_loop",
    "stepInStart": "00140_stepin01_start", "stepIn": "00141_stepin01", "stepInEnd": "00142_stepin01_end",
    "stepOutStart": "00145_stepout01_start", "stepOut": "00146_stepout01", "stepOutEnd": "00147_stepout01_end",
    "jumpStart": "00150_jumpup01_start", "jumpLoop": "00151_jumpup01_loop",
    "fallStart": "00152_jumpdown01_start", "fallLoop": "00153_jumpdown01_loop", "land": "00155_land02",
    "attack": "00400_attack01",
    "attackAltStart": "00420_attack03_start", "attackAltLoop": "00421_attack03_loop", "attackAltEnd": "00422_attack03_end",
    "attackRanged": "00450_rangeattack01",
    "attackRangedAltStart": "00460_rangeattack02_start", "attackRangedAltLoop": "00461_rangeattack02_loop",
    "attackRangedAltEnd": "00462_rangeattack02_end",
    "charge": "00490_charge01_loop",
    "hit": "00500_damage01", "hitAlt": "00501_damage02",
    "stunStart": "00510_stun01_start", "stunLoop": "00511_stun01_loop", "stunEnd": "00512_stun01_end",
    "faintStart": "00520_down01_start", "faintLoop": "00521_down01_loop", "faintEnd": "00522_down01_end",
    "restStart": "00270_rest01_start", "restLoop": "00271_rest01_loop", "restEnd": "00272_rest01_end",
    "sleepStart": "00280_sleep01_start", "sleepLoop": "00281_sleep01_loop", "sleepEnd": "00282_sleep01_end",
    "eatStart": "00293_eat02_start", "eatLoop": "00294_eat02_loop", "eatEnd": "00295_eat02_end",
    "roar": "00300_roar01", "appeal": "00310_appeal01", "refresh": "00320_refresh01",
    "searchStart": "00330_search01_start", "searchLoop": "00331_search01_loop", "searchEnd": "00332_search01_end",
    "happy": "00550_glad01", "notice": "00560_notice01", "dislike": "00563_hate01",
    "blink": "08000_eye01", "staticPose": "08201_loop01_loop",
}

# Os *_alb.png do dump NÃO são a cor final: o Legends compõe a cor a partir de máscaras (*_lym)
# e de cores por camada guardadas no material (.trmtr). Por isso a textura é assada (bake)
# a partir do shader do addon, que já reproduz essa composição.
# Um material do jogo por material do addon, exceto l_eye e r_eye, que viram um só ("eye").
SMALL_MATERIALS = ("eye", "fire")  # bake em 256; o resto (corpo) em 1024


def game_material_name(addon_name):
    base = addon_name.split(".")[0]
    return "eye" if base in ("l_eye", "r_eye") else base


def bake_size(game_name):
    return 256 if game_name in SMALL_MATERIALS else 1024


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:]
    opts = dict(zip(argv[::2], argv[1::2]))
    return int(opts["--dex"]), opts["--src"], opts["--out"], opts.get("--name")


def clean_scene():
    for name in ("Camera", "Light", "Cube"):
        obj = bpy.data.objects.get(name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)


def normalize_uvs(pm):
    """Leva as UVs de cada face para dentro de 0..1.

    Alguns materiais (ex.: body_b do Bulbasaur/Squirtle) vivem em v = 1..2 (textura repetida no dump).
    O bake só escreve em 0..1, então cada face é deslocada pelo número inteiro que a tira de fora.
    """
    import math
    for obj in bpy.data.objects:
        if obj.type != "MESH" or not obj.name.startswith(pm) or not obj.data.uv_layers:
            continue
        uv = obj.data.uv_layers[0].data
        for poly in obj.data.polygons:
            loops = [uv[i] for i in poly.loop_indices]
            du = math.floor(min(l.uv[0] for l in loops) + 1e-4)
            dv = math.floor(min(l.uv[1] for l in loops) + 1e-4)
            if du or dv:
                for l in loops:
                    l.uv = (l.uv[0] - du, l.uv[1] - dv)


def bake_textures(tex_dir, pm):
    """Assa a cor final de cada material (passe difuso, sem luz) e salva em tex_dir."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 4
    images = {}
    usados = {slot.material for obj in bpy.data.objects if obj.type == "MESH"
              for slot in obj.material_slots if slot.material}
    for mat in usados:
        if not (mat.use_nodes and any(n.type == "GROUP" for n in mat.node_tree.nodes)):
            continue
        game_name = game_material_name(mat.name)
        if game_name not in images:
            size = bake_size(game_name)
            img = bpy.data.images.new(f"bake_{game_name}", size, size, alpha=True)
            img.generated_color = (0, 0, 0, 0)
            images[game_name] = img
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = images[game_name]
        mat.node_tree.nodes.active = node
    for obj in bpy.data.objects:
        if obj.type != "MESH" or "lod" in obj.name or not obj.name.startswith(pm):
            continue
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, margin=8, use_clear=False)
    for game_name, img in images.items():
        img.filepath_raw = os.path.join(tex_dir, f"{pm}_00_00_{game_name}_alb.png")
        img.file_format = "PNG"
        img.save()
    return sorted(images)


def merge_duplicate_slots():
    """Uma malha vira um slot por material.

    l_eye e r_eye viram o mesmo material, mas continuariam em dois slots (duas primitivas no .glb),
    o que gasta dois índices de material no jogo. Aqui os slots repetidos são fundidos.
    """
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        first = {}
        remap = []
        for i, slot in enumerate(obj.material_slots):
            remap.append(first.setdefault(slot.material, i))
        for poly in obj.data.polygons:
            poly.material_index = remap[poly.material_index]
        used = {poly.material_index for poly in obj.data.polygons}
        for i in reversed(range(len(obj.material_slots))):
            if i not in used:
                obj.data.materials.pop(index=i)


def rebuild_materials(names):
    """Troca os materiais do shader do addon por Principled simples, com nomes estáveis."""
    novos = {}
    for game_name in names:
        mat = bpy.data.materials.new(f"game_{game_name}")
        mat.use_nodes = True
        # a cor vem toda da textura assada: fator de cor 1 (o padrão do Blender, 0.8, escureceria)
        # e material fosco (roughness 1, sem metal), como o resto do jogo espera
        bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
        bsdf.inputs["Metallic"].default_value = 0.0
        bsdf.inputs["Roughness"].default_value = 1.0
        novos[game_name] = mat
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            if slot.material and not slot.material.name.startswith("game_"):
                game_name = game_material_name(slot.material.name)
                if game_name in novos:
                    slot.material = novos[game_name]
    merge_duplicate_slots()
    for mat in list(bpy.data.materials):
        if not mat.name.startswith("game_"):
            bpy.data.materials.remove(mat)
    for game_name, mat in novos.items():
        mat.name = game_name
    for img in list(bpy.data.images):
        bpy.data.images.remove(img)


def main():
    dex, src, out, name = parse_args()
    pm = f"pm{dex:04d}"
    folder = os.path.join(src, pm, f"{pm}_00_00")
    name = name or pm
    addon_utils.enable(ADDON, default_set=False)

    # rotate90: o dump vem com o eixo de altura trocado; sem isso o modelo sai deitado
    bpy.ops.import_scene.trmdl(filepath=os.path.join(folder, f"{pm}_00_00.trmdl"), rotate90=True)
    clean_scene()
    arm = bpy.data.objects[f"{pm}_00_00"]
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)

    faltando = []
    for game_name, legends_name in ANIMATIONS.items():
        candidates = [legends_name] + [f"{p}{legends_name[1:]}" for p in "21"]
        path = next((os.path.join(folder, f"{pm}_00_00_{c}.tranm") for c in candidates
                     if os.path.exists(os.path.join(folder, f"{pm}_00_00_{c}.tranm"))), None)
        if not path:
            faltando.append(game_name)
            continue
        bpy.ops.import_scene.gfbanm(filepath=path)
        action = bpy.data.actions.get(os.path.basename(path)[:-len(".tranm")])
        action.name = game_name
        action.use_fake_user = True

    models = os.path.join(out, "models")
    tex = os.path.join(out, "textures", f"{dex:03d}-{name}", "default")
    os.makedirs(models, exist_ok=True)
    os.makedirs(tex, exist_ok=True)
    normalize_uvs(pm)
    materials = bake_textures(tex, pm)
    rebuild_materials(materials)

    glb = os.path.join(models, f"{dex:03d}-{name}.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb, export_format="GLB", export_image_format="NONE",
        export_animations=True, export_animation_mode="ACTIONS",
        export_force_sampling=True, export_frame_step=2, export_optimize_animation_size=True)
    print(f"MATERIAIS {materials}")
    print(f"CONVERTIDO {glb} ({os.path.getsize(glb)} bytes) animações={len(ANIMATIONS) - len(faltando)} faltando={faltando}")


main()
