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
import bpy, math, os, struct, sys, addon_utils
from mathutils import Vector

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

# Voo livre (docs/features/060-ajustes-por-especie.md): o conjunto de voo (2xxxx) das aves.
# Opcionais e SEM o fallback acima — espécie sem voo não ganha cópia das animações de chão.
# O voo do dump fica bem acima do chão; no jogo quem sobe é o corpo, então os clipes descem
# até o chão do idle (`lower_flight_to_ground`), como no conversor do LGPE.
FLIGHT_ANIMATIONS = {
    "flyIdle": "20000_defaultwait01_loop", "fly": "20030_walk01_loop", "flyFast": "20100_run01_loop",
    "flyDashStart": "20140_stepin01_start", "flyDash": "20141_stepin01", "flyDashEnd": "20142_stepin01_end",
}
GROUND_TOLERANCE = 0.05  # metros

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


# Visibilidade de malha por animação (.tracm, flatbuffer ao lado do .tranm). Aves do Z-A trocam a
# asa fechada (malha à parte) pela aberta (no corpo): a aberta some pela escala dos ossos, que já
# vem no .tranm, mas a fechada só some pela trilha de visibilidade, que o addon não importa.
# O glTF não tem visibilidade animada, então a malha escondida vira escala quase zero nos ossos
# que só ela usa.
OVERLAY_ANIMATIONS = ("blink",)  # tocam por cima das outras: não escondem malha
HIDDEN_SCALE = 0.001


def read_mesh_visibility(path):
    """{nome da malha: função quadro -> visível} das trilhas de um .tracm."""
    d = open(path, "rb").read()
    u32 = lambda o: struct.unpack_from("<I", d, o)[0]
    ref = lambda o: o + u32(o)

    def field(table, k):
        vtable = table - struct.unpack_from("<i", d, table)[0]
        if 4 + 2 * k >= struct.unpack_from("<H", d, vtable)[0]:
            return None
        off = struct.unpack_from("<H", d, vtable + 4 + 2 * k)[0]
        return table + off if off else None

    def bytes_of(table, k):
        p = field(table, k)
        if p is None:
            return b""
        v = ref(p)
        return d[v + 4:v + 4 + u32(v)]

    def bit(data, i):
        return bool(data[i // 8] >> (i % 8) & 1) if i // 8 < len(data) else None

    tracks = {}
    meshes = field(ref(0), 1)
    if meshes is None:
        return tracks
    vec = ref(meshes)
    for i in range(u32(vec)):
        track = ref(vec + 4 + 4 * i)
        name_at = ref(field(track, 0))
        name = d[name_at + 4:name_at + 4 + u32(name_at)].decode()
        if field(track, 5) is None:
            continue
        union = ref(field(ref(field(track, 5)), 2))
        kind, value = d[field(union, 0)], ref(field(union, 1))
        if kind == 1:  # valor fixo
            fixed = field(value, 0) is not None and d[field(value, 0)] == 1
            tracks[name] = lambda f, v=fixed: v
        elif kind == 2:  # um bit por quadro
            bits = bytes_of(value, 0)
            last = bit(bits, len(bits) * 8 - 1)
            tracks[name] = lambda f, b=bits, l=last: bit(b, f) if bit(b, f) is not None else l
        elif kind == 4:  # quadros-chave (um byte cada) com os valores em bits
            keys, bits = bytes_of(value, 0), bytes_of(value, 1)

            def keyed(f, k=keys, b=bits):
                i = max((n for n, frame in enumerate(k) if frame <= f), default=0)
                return bit(b, i)
            tracks[name] = keyed
        else:
            raise ValueError(f"{path}: trilha de visibilidade de tipo {kind} desconhecido ({name})")
    return tracks


def exclusive_bones(arm):
    """{nome da malha: ossos que só ela usa} — escalar esses ossos esconde a malha.

    Todos os ossos do ramo, não só o do topo: com só o pai encolhido, o exportador do glTF
    compensa o filho com escala inversa (1000), e o Three interpola os dois em separado entre
    quadros e entre animações — no meio do caminho o produto explode e a malha fica gigante.
    """
    used = {}
    for obj in arm.children:
        if obj.type != "MESH":
            continue
        names = {g.index: g.name for g in obj.vertex_groups}
        used[obj.data.name.split(".")[0]] = {
            names[g.group] for v in obj.data.vertices for g in v.groups if g.weight > 0}
    exclusive = {}
    for mesh, bones in used.items():
        others = set().union(*(b for m, b in used.items() if m != mesh))
        exclusive[mesh] = sorted(b for b in bones - others if b in arm.pose.bones)
    return exclusive


def apply_mesh_visibility(arm, action, tracm, bones_by_mesh):
    """Escala quase zero, quadro a quadro, nos ossos das malhas invisíveis da animação."""
    visibility = read_mesh_visibility(tracm)
    hidden = {mesh: fn for mesh, fn in visibility.items()
              if bones_by_mesh.get(mesh) and not all(fn(f) for f in range(int(action.frame_range[1]) + 1))}
    if not hidden:
        return
    scene = bpy.context.scene
    arm.animation_data.action = action
    start, end = (int(x) for x in action.frame_range)
    bones = [(bone, visible) for mesh, visible in hidden.items() for bone in bones_by_mesh[mesh]]
    # Primeiro lê a escala original de cada quadro (osso sem trilha de escala fica na de
    # descanso), depois grava: gravar no meio da leitura mudaria o que vem depois.
    for bone, _ in bones:
        arm.pose.bones[bone].scale = (1, 1, 1)
    original = {}
    for frame in range(start, end + 1):
        scene.frame_set(frame)
        for bone, _ in bones:
            original[bone, frame] = tuple(arm.pose.bones[bone].scale)
    for frame in range(start, end + 1):
        for bone, visible in bones:
            pb = arm.pose.bones[bone]
            pb.scale = original[bone, frame] if visible(frame - start) else (HIDDEN_SCALE,) * 3
            pb.keyframe_insert(data_path="scale", frame=frame)
    arm.animation_data.action = None
    print(f"VISIBILIDADE {action.name}: {sorted(hidden)}")


def lowest_point(arm, action):
    """Altura (Z do mundo no Blender) do osso mais baixo no clipe todo. Fora da conta a raiz
    (origin) e os pontos de efeito, que ficam parados na origem ou soltos."""
    scene = bpy.context.scene
    arm.animation_data.action = action
    bones = [pb for pb in arm.pose.bones
             if pb.name != "origin" and "eff" not in pb.name.lower()]
    start, end = (int(x) for x in action.frame_range)
    lowest = math.inf
    for frame in range(start, end + 1):
        scene.frame_set(frame)
        lowest = min(lowest, min((arm.matrix_world @ pb.head).z for pb in bones))
    return lowest


def lower_flight_to_ground(arm, actions):
    """Desce os clipes de voo que ficam no ar até o chão do idle, pelo osso origin. O
    deslocamento entra somado ao que o origin já anima (o balanço do voo continua)."""
    if "idle" not in actions:
        return
    ground = lowest_point(arm, actions["idle"])
    origin = arm.pose.bones["origin"]
    for name in FLIGHT_ANIMATIONS:
        action = actions.get(name)
        if not action:
            continue
        height = lowest_point(arm, action) - ground
        if height <= GROUND_TOLERANCE:
            continue
        start = int(action.frame_range[0])
        arm.animation_data.action = action
        bpy.context.scene.frame_set(start)
        # do mundo pro esqueleto, e do esqueleto pro referencial do osso
        down = arm.matrix_world.to_3x3().inverted() @ Vector((0, 0, -height))
        to_armature = origin.matrix.to_3x3() @ origin.matrix_basis.to_3x3().inverted()
        local = to_armature.inverted() @ down
        curves = {fc.array_index: fc for layer in action.layers for strip in layer.strips
                  for bag in strip.channelbags for fc in bag.fcurves
                  if fc.data_path == 'pose.bones["origin"].location'}
        for i in range(3):
            fc = curves.get(i)
            if fc:
                for key in fc.keyframe_points:
                    key.co.y += local[i]
                    key.handle_left.y += local[i]
                    key.handle_right.y += local[i]
            else:
                origin.location[i] = local[i]
                origin.keyframe_insert(data_path="location", index=i, frame=start)
                origin.location[i] = 0
        print(f"NO CHÃO {name}: desceu {height:.2f} m")
    arm.animation_data.action = None


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
    visibility = []
    actions = {}
    for game_name, legends_name in {**ANIMATIONS, **FLIGHT_ANIMATIONS}.items():
        flight = game_name in FLIGHT_ANIMATIONS
        candidates = [legends_name] + ([] if flight else [f"{p}{legends_name[1:]}" for p in "21"])
        path = next((os.path.join(folder, f"{pm}_00_00_{c}.tranm") for c in candidates
                     if os.path.exists(os.path.join(folder, f"{pm}_00_00_{c}.tranm"))), None)
        if not path:
            if not flight:
                faltando.append(game_name)
            continue
        bpy.ops.import_scene.gfbanm(filepath=path)
        action = bpy.data.actions.get(os.path.basename(path)[:-len(".tranm")])
        action.name = game_name
        action.use_fake_user = True
        actions[game_name] = action
        tracm = path[:-len(".tranm")] + ".tracm"
        if game_name not in OVERLAY_ANIMATIONS and os.path.exists(tracm):
            visibility.append((action, tracm))

    bones_by_mesh = exclusive_bones(arm)
    for action, tracm in visibility:
        apply_mesh_visibility(arm, action, tracm, bones_by_mesh)
    lower_flight_to_ground(arm, actions)

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
