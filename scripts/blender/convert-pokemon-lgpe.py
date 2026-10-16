"""Converte um Pokémon do Let's Go (.gfbmdl + .gfbanm) em um .glb pronto para o jogo.

Para as espécies que só existem no LGPE (docs/features/059-as-10-especies.md — Caterpie,
Rattata, Spearow). Roda em modo headless, com o addon Pokemon-Switch-Model-Importer-Blender
instalado:

  node scripts/lgpe/unpack-pokemon.js --src <bin/pokemon/pm0010_00> --out <trabalho>
  blender --background --python scripts/blender/convert-pokemon-lgpe.py -- \
      --src <bin/pokemon/pm0010_00> --textures <trabalho> --out <pasta> --name caterpie

`--src` é a pasta do Pokémon extraída do LGPE-Poke.zip e do LGPE-PokeAnim.zip (mdl/ e anm/
lado a lado). O addon não lê as texturas (.bntx): o unpack-pokemon.js as converte em PNG e
grava os parâmetros de cada material (materials.json) em <trabalho>.

Saída:
  <out>/models/<dex>-<nome>.glb               modelo + rig + animações (sem texturas embutidas)
  <out>/textures/<dex>-<nome>/default/*.png   cor final assada (bake), uma por material do jogo
"""
import bpy, importlib, json, math, os, re, sys, addon_utils
from mathutils import Vector

ADDON = "Pokemon-Switch-Model-Importer-Blender-main"

# nome no jogo -> nome do arquivo no LGPE (sem o prefixo pm<dex>_00_ e sem a extensão), ou
# uma lista de candidatos em ordem. O LGPE tem bem menos animações que o Z-A, e nem toda
# espécie tem todas (o Caterpie não tem ataque físico; o Rattata não dorme): um desmaio sem
# "levantar" e nada de dash, piscar ou apelo próprio (docs/features/059-as-10-especies.md).
ANIMATIONS = {
    "idle": "fi01_wait01", "idleAlt": "kw33_moveC01", "battleIdle": "ba10_waitA01",
    "walk": "fi20_walk01", "run": "fi21_run01",
    "jumpStart": "ba01_jump01", "jumpLoop": "ba01_landA01", "fallLoop": "ba01_landB01",
    "land": "ba01_landC01",
    "attack": ["ba20_buturi01", "ba21_tokusyu01"], "attackRanged": "ba21_tokusyu01", "hit": "ba30_damageS01", "faintStart": "ba41_down01",
    "restStart": "kw20_drowseA01", "restLoop": "kw20_drowseB01", "restEnd": "kw20_drowseC01",
    "eatStart": "kw50_eatA01", "eatLoop": "kw50_eatB01", "eatEnd": "kw50_eatC01",
    "appeal": "kw32_happyB01", "roar": "kw30_hate01",
    # boca abrindo e fechando: não toca no jogo, é a referência do grito animado (clips.cry)
    # no laboratório de animação
    "mouth": "mouth01",
}

# Por espécie (número da Pokédex), o que muda no mapa acima. O Spearow voa no mapa do LGPE:
# o idle do mapa é pairando no ar, então o parado é o de interação (de pé, asa fechada).
OVERRIDES = {21: {"idle": "kw01_wait01"}}
# Clipes de locomoção que precisam ficar no chão: se o ponto mais baixo do esqueleto passa do
# do idle por mais que a tolerância (o andar e o correr do Spearow são voo, bem acima do chão),
# o clipe inteiro desce até o chão do idle — o "voo rasante" (decisão do usuário, 059).
GROUNDED = ("walk", "run")
GROUND_TOLERANCE = 10  # centímetros, como o arquivo

# O LGPE grava em centímetros; os .glb do jogo são em metros.
CENTIMETERS = 0.01
# Malha escondida numa animação (as asas fechadas do Spearow) vira escala quase zero nos ossos
# que só ela usa: o glTF não tem visibilidade animada.
HIDDEN_SCALE = 0.001
# Atlas de expressões do olho (piscar): no LGPE a textura do olho tem as expressões em
# colunas e linhas, e a animação escolhe a célula somando ao deslocamento de UV da cor
# (ColorUVTranslateU/V). O olho do jogo vira um atlas com a mesma grade, cada célula com a
# textura de olho inteira assada naquela expressão; o jogo troca de célula pelo eyeStates
# (docs/features/023). Colunas: a expressão normal e a outra (raiva); linhas, de cima para
# baixo: aberto, meio fechado, fechado e apertado (dano/desmaio). Só para espécie com
# animação de olho (eye01) — o Caterpie não tem. O deslocamento em V do LGPE anda de cima
# para baixo na imagem, ao contrário do V do Blender: as linhas vão com o sinal trocado. A
# coluna da outra expressão é o deslocamento 0.5 do LGPE (o normal é 1).
EYE_ATLAS_COLUMNS = (0, -0.5)
EYE_ATLAS_ROWS = (0, -0.25, -0.5, -0.75)
EYE_ANIMATION = "eye01"
# Lado da textura assada: o olho ocupa pouco do UV, então pede mais pixels por área.
BAKE_SIZE = {"eye": 512}
BAKE_SIZE_DEFAULT = 1024
# Os clipes vêm em 30 ou 60 fps (o addon troca o fps da cena a cada import): todos são
# levados para este, que é o da cena na exportação.
FPS = 30


def game_material_name(lgpe_name):
    """Minúsculo, sem o número do fim, com a letra da
    variante separada (BodyA -> body_a); os dois olhos (EyeL/EyeR) viram um só."""
    base = re.sub(r"\d+$", "", lgpe_name.split(".")[0])
    if re.fullmatch(r"Eye[LR]", base):
        return "eye"
    return re.sub(r"([a-z])([A-Z])$", r"\1_\2", base).lower()


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:]
    opts = dict(zip(argv[::2], argv[1::2]))
    return opts["--src"], opts["--textures"], opts["--out"], opts["--name"]


def clean_scene():
    for name in ("Camera", "Light", "Cube"):
        obj = bpy.data.objects.get(name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)


def action_fcurves(action):
    """F-curves de uma ação (no Blender 5 elas moram nas camadas/slots da ação)."""
    return [fc for layer in action.layers for strip in layer.strips
            for bag in strip.channelbags for fc in bag.fcurves]


def retime(action, factor):
    for fc in action_fcurves(action):
        for key in fc.keyframe_points:
            key.co.x *= factor
            key.handle_left.x *= factor
            key.handle_right.x *= factor


def apply_meters(arm, meshes):
    """Leva malha, esqueleto e animações de centímetros para metros, com a escala aplicada:
    escala só no nó raiz deixaria a matriz de bind em 100x e o Three encolheria o modelo de
    novo no skinning. Aplicar a escala não mexe nas animações, então a translação dos ossos é
    convertida à mão."""
    bpy.ops.object.select_all(action="DESELECT")
    for obj in [arm, *meshes]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = arm
    arm.scale = (CENTIMETERS,) * 3
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for action in bpy.data.actions:
        for fc in action_fcurves(action):
            if fc.data_path.endswith(".location"):
                for key in fc.keyframe_points:
                    key.co.y *= CENTIMETERS
                    key.handle_left.y *= CENTIMETERS
                    key.handle_right.y *= CENTIMETERS


def read_visibility(path):
    """{skin: função quadro -> visível} do bloco de visibilidade do .gfbanm (lido pelas classes
    do addon). Mesmo formato do .tracm do Z-A: valor fixo, um bit por quadro ou quadros-chave
    com um bit cada."""
    anim = importlib.import_module(ADDON + ".GFLib.Anim.Animation")
    data = anim.AnimationT.InitFromPackedBuf(bytearray(open(path, "rb").read()))
    tracks = {}
    for track in (data.visibility.tracks if data.visibility else None) or []:
        name = track.name.decode() if isinstance(track.name, bytes) else track.name
        values, frames = track.values, getattr(track.values, "frames", None)
        if isinstance(values.byte, int):  # valor fixo
            tracks[name] = lambda f, v=bool(values.byte): v
            continue
        data_bytes = [int(b) for b in values.byte]
        bit = lambda i, b=data_bytes: (bool(b[i // 8] >> (i % 8) & 1) if i // 8 < len(b) else None)
        if frames is None:  # um bit por quadro; depois do fim, vale o último
            last = bit(len(data_bytes) * 8 - 1)
            tracks[name] = lambda f, bit=bit, last=last: bit(f) if bit(f) is not None else last
        else:  # quadros-chave
            keys = [int(k) for k in frames]
            tracks[name] = lambda f, k=keys, bit=bit: bit(
                max((n for n, frame in enumerate(k) if frame <= f), default=0))
    return tracks


def exclusive_bones(meshes_by_skin):
    """{skin: ossos que só a malha dela usa} — escalar esses ossos esconde a malha. Todos os
    ossos do ramo, não só o do topo (ver o mesmo trecho no convert-pokemon.py: com só o pai
    encolhido, o Three interpolaria pai e filho em separado e a malha estouraria)."""
    used = {}
    for skin, obj in meshes_by_skin.items():
        names = {g.index: g.name for g in obj.vertex_groups}
        used[skin] = {names[g.group] for v in obj.data.vertices for g in v.groups if g.weight > 0}
    return {skin: sorted(bones - set().union(*(b for k, b in used.items() if k != skin)))
            for skin, bones in used.items()}


def apply_visibility(arm, action, visibility, bones_by_skin):
    """Escala quase zero, quadro a quadro, nos ossos das malhas invisíveis da animação."""
    start, end = (int(x) for x in action.frame_range)
    hidden = {skin: fn for skin, fn in visibility.items()
              if bones_by_skin.get(skin) and not all(fn(f) for f in range(end - start + 1))}
    if not hidden:
        return
    scene = bpy.context.scene
    arm.animation_data.action = action
    bones = [(bone, visible) for skin, visible in hidden.items() for bone in bones_by_skin[skin]]
    # Primeiro lê a escala original de cada quadro, depois grava: gravar no meio da leitura
    # mudaria o que vem depois.
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
    print(f"VISIBILIDADE {action.name}: {sorted(hidden)}")


def lowest_point(arm, action):
    """Altura (no espaço do esqueleto, Y para cima no LGPE) do osso mais baixo no clipe todo.
    Só os ossos do corpo: a raiz (pm<dex>_00), o Origin, as skins e os pontos de efeito (Eff*)
    ficam parados na origem ou soltos e não contam."""
    scene = bpy.context.scene
    arm.animation_data.action = action
    bones = [pb for pb in arm.pose.bones
             if not pb.name.startswith(("Eff", "pm")) and pb.name != "Origin"]
    start, end = (int(x) for x in action.frame_range)
    lowest = math.inf
    for frame in range(start, end + 1):
        scene.frame_set(frame)
        lowest = min(lowest, min(pb.head[1] for pb in bones))
    return lowest


def lower_to_ground(arm, actions):
    """Desce os clipes de GROUNDED que ficam no ar até o chão do idle, pelo osso Origin (que
    não tem translação própria: o deslocamento dele é descartado na importação)."""
    if "idle" not in actions:
        return
    ground = lowest_point(arm, actions["idle"])
    origin = arm.pose.bones["Origin"]
    for name in GROUNDED:
        action = actions.get(name)
        if not action:
            continue
        height = lowest_point(arm, action) - ground
        if height <= GROUND_TOLERANCE:
            continue
        # a descida vale o clipe todo: sai qualquer trilha de translação que o Origin tenha
        for bag in (bag for layer in action.layers for strip in layer.strips
                    for bag in strip.channelbags):
            for fc in [fc for fc in bag.fcurves if fc.data_path == 'pose.bones["Origin"].location']:
                bag.fcurves.remove(fc)
        # a translação do osso é no referencial dele: leva a descida (Y do esqueleto) para lá
        start = int(action.frame_range[0])
        bpy.context.scene.frame_set(start)
        to_armature = origin.matrix.to_3x3() @ origin.matrix_basis.to_3x3().inverted()
        origin.location = to_armature.inverted() @ Vector((0, -height, 0))
        origin.keyframe_insert(data_path="location", frame=start)
        origin.location = (0, 0, 0)
        print(f"NO CHÃO {name}: desceu {height:.1f} cm")
    arm.animation_data.action = None


def import_animations(arm, anm, bones_by_skin, overrides):
    scene = bpy.context.scene
    faltando = []
    actions = {}
    for game_name, candidates in {**ANIMATIONS, **overrides}.items():
        candidates = [candidates] if isinstance(candidates, str) else candidates
        file = next((f for c in candidates for f in os.listdir(anm) if f.endswith(f"_{c}.gfbanm")),
                    None)
        if not file:
            faltando.append(game_name)
            continue
        bpy.context.view_layer.objects.active = arm
        arm.select_set(True)
        # ignore_origin_location: andar e correr trazem o deslocamento no osso Origin, e no
        # jogo quem anda é o corpo físico
        bpy.ops.import_scene.gfbanm(directory=anm + os.sep, files=[{"name": file}],
                                    ignore_origin_location=True)
        action = bpy.data.actions[file[:-len(".gfbanm")]]
        action.name = game_name
        # antes de mudar o fps: a trilha de visibilidade conta os quadros do arquivo
        apply_visibility(arm, action, read_visibility(os.path.join(anm, file)), bones_by_skin)
        if scene.render.fps != FPS:
            retime(action, FPS / scene.render.fps)
        action.use_fake_user = True
        actions[game_name] = action
    lower_to_ground(arm, actions)
    arm.animation_data.action = None
    scene.render.fps = FPS
    return faltando


def game_uv(meshes):
    """UV do jogo (alvo do bake): o original com cada face deslocada por inteiros para dentro
    de 0..1 — os olhos (e o corpo B do Spearow) vivem fora, e o bake só escreve em 0..1."""
    for obj in meshes:
        source = obj.data.uv_layers[0]
        target = obj.data.uv_layers.new(name="GameUV")
        for poly in obj.data.polygons:
            loops = list(poly.loop_indices)
            du = math.floor(min(source.data[i].uv[0] for i in loops) + 1e-4)
            dv = math.floor(min(source.data[i].uv[1] for i in loops) + 1e-4)
            for i in loops:
                u, v = source.data[i].uv
                target.data[i].uv = (u - du, v - dv)
        obj.data.uv_layers.active = target


def socket(sockets, identifier):
    return next(s for s in sockets if s.identifier == identifier)


def sample_layer(tree, uv, layer, textures):
    """Nó de imagem com a conta de UV do material do LGPE: (uv + deslocamento) * escala — o
    deslocamento entra antes da escala: é o que deixa os dois olhos na mesma coluna do atlas e
    o piscar na ordem certa — e a repetição de cada eixo (repetir, espelhar ou prender), como
    no jogo original."""
    nodes, links = tree.nodes, tree.links
    if any(layer["base"]):
        print(f"AVISO {layer['texture']}: base {layer['base']} ignorada")
    translates = []  # o deslocamento de cada eixo, para o atlas do olho mexer depois
    split = nodes.new("ShaderNodeSeparateXYZ")
    links.new(uv.outputs["UV"], split.inputs[0])
    join = nodes.new("ShaderNodeCombineXYZ")
    for axis in range(2):
        mad = nodes.new("ShaderNodeMath")
        mad.operation = "MULTIPLY_ADD"
        links.new(split.outputs[axis], mad.inputs[0])
        mad.inputs[1].default_value = layer["scale"][axis]
        mad.inputs[2].default_value = layer["translate"][axis] * layer["scale"][axis]
        wrap = nodes.new("ShaderNodeMath")
        if layer["wrap"][axis] == "mirror":
            wrap.operation = "PINGPONG"
            wrap.inputs[1].default_value = 1
        elif layer["wrap"][axis] == "repeat":
            wrap.operation = "WRAP"
            wrap.inputs[1].default_value = 1
            wrap.inputs[2].default_value = 0
        else:
            wrap.operation = "ADD"
            wrap.use_clamp = True
        links.new(mad.outputs[0], wrap.inputs[0])
        links.new(wrap.outputs[0], join.inputs[axis])
        translates.append((mad.inputs[2], layer["translate"][axis], layer["scale"][axis]))
    image = nodes.new("ShaderNodeTexImage")
    image.image = bpy.data.images.load(os.path.join(textures, layer["texture"] + ".png"),
                                       check_existing=True)
    image.extension = "EXTEND"
    links.new(join.outputs[0], image.inputs["Vector"])
    return image, translates


def bake_all(meshes):
    for obj in meshes:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.bake(type="EMIT", margin=8, use_clear=False)


def bake_eye_atlas(meshes, targets, eye_nodes, size):
    """Assa o olho uma vez por célula de EYE_ATLAS_* e monta o atlas (célula (0, 0) no topo
    à esquerda). Nas passadas das células, os outros materiais assam numa imagem
    descartável, para não refazer o corpo."""
    import numpy as np
    scratch = bpy.data.images.new("bake_scratch", 8, 8, alpha=True)
    for target, is_eye in targets:
        if not is_eye:
            target.image = scratch
    columns, rows = len(EYE_ATLAS_COLUMNS), len(EYE_ATLAS_ROWS)
    atlas = np.zeros((rows * size, columns * size, 4), dtype=np.float32)
    for c, du in enumerate(EYE_ATLAS_COLUMNS):
        for r, dv in enumerate(EYE_ATLAS_ROWS):
            cell = bpy.data.images.new(f"bake_eye_{c}_{r}", size, size, alpha=True)
            cell.generated_color = (0, 0, 0, 0)
            for target, is_eye in targets:
                if is_eye:
                    target.image = cell
            for (u, base_u, scale_u), (v, base_v, scale_v) in eye_nodes:
                u.default_value = (base_u + du) * scale_u
                v.default_value = (base_v + dv) * scale_v
            bake_all(meshes)
            pixels = np.empty(size * size * 4, dtype=np.float32)
            cell.pixels.foreach_get(pixels)
            # as linhas do Blender vão de baixo para cima: a linha 0 do atlas fica no topo
            y = (rows - 1 - r) * size
            atlas[y:y + size, c * size:(c + 1) * size] = pixels.reshape(size, size, 4)
    image = bpy.data.images.new("bake_eye_atlas", columns * size, rows * size, alpha=True)
    image.pixels.foreach_set(atlas.ravel())
    return image


def bake_textures(meshes, textures, tex_dir, pm, animated_eye):
    """Assa a cor final de cada material do jogo (passe de emissão, sem luz) no UV do jogo.

    Cada material do LGPE vira um material de bake: a textura de cor com a conta de UV dele e,
    com camada 1 (a íris do Rattata), a camada por baixo da cor onde a cor é transparente."""
    infos = {m["name"]: m for m in json.load(open(os.path.join(textures, "materials.json")))}
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 4
    images = {}
    targets = []  # (nó de imagem alvo, é do olho)
    eye_nodes = []  # por eixo: (deslocamento da cor do olho, valor do material, escala)
    for obj in meshes:
        for slot in obj.material_slots:
            source = slot.material
            if source.name.startswith("bake_"):
                continue
            info = infos[source.name.split(".")[0]]
            game_name = game_material_name(info["name"])
            if game_name not in images:
                size = BAKE_SIZE.get(game_name, BAKE_SIZE_DEFAULT)
                img = bpy.data.images.new(f"bake_{game_name}", size, size, alpha=True)
                img.generated_color = (0, 0, 0, 0)
                images[game_name] = img
            mat = bpy.data.materials.new(f"bake_{info['name']}")
            mat.use_nodes = True
            tree = mat.node_tree
            tree.nodes.clear()
            uv = tree.nodes.new("ShaderNodeUVMap")
            uv.uv_map = obj.data.uv_layers[0].name
            color, translates = sample_layer(tree, uv, info["color"], textures)
            if game_name == "eye":
                eye_nodes.append(translates)
            result = color.outputs["Color"]
            if info["layer"]:
                layer, _ = sample_layer(tree, uv, info["layer"], textures)
                mix = tree.nodes.new("ShaderNodeMix")
                mix.data_type = "RGBA"
                tree.links.new(color.outputs["Alpha"], socket(mix.inputs, "Factor_Float"))
                tree.links.new(layer.outputs["Color"], socket(mix.inputs, "A_Color"))
                tree.links.new(color.outputs["Color"], socket(mix.inputs, "B_Color"))
                result = socket(mix.outputs, "Result_Color")
            emission = tree.nodes.new("ShaderNodeEmission")
            tree.links.new(result, emission.inputs["Color"])
            output = tree.nodes.new("ShaderNodeOutputMaterial")
            tree.links.new(emission.outputs[0], output.inputs["Surface"])
            target = tree.nodes.new("ShaderNodeTexImage")
            target.image = images[game_name]
            tree.nodes.active = target
            targets.append((target, game_name == "eye"))
            slot.material = mat
    bake_all(meshes)
    if animated_eye and "eye" in images:
        images["eye"] = bake_eye_atlas(meshes, targets, eye_nodes, images["eye"].size[0])
        print(f"ATLAS DO OLHO {len(EYE_ATLAS_COLUMNS)}x{len(EYE_ATLAS_ROWS)}")
    for game_name, img in images.items():
        img.filepath_raw = os.path.join(tex_dir, f"{pm}_00_{game_name}_alb.png")
        img.file_format = "PNG"
        img.save()
    return sorted(images)


def merge_duplicate_slots(obj):
    """Um slot por material: Body00/Body01 (ou EyeL/EyeR) viram o mesmo material do jogo e
    continuariam em dois slots (duas primitivas no .glb), gastando dois índices de material."""
    first = {}
    remap = [first.setdefault(slot.material, i) for i, slot in enumerate(obj.material_slots)]
    for poly in obj.data.polygons:
        poly.material_index = remap[poly.material_index]
    used = {poly.material_index for poly in obj.data.polygons}
    for i in reversed(range(len(obj.material_slots))):
        if i not in used:
            obj.data.materials.pop(index=i)


def rebuild_materials(meshes):
    """Troca os materiais do addon por Principled simples, com os nomes do jogo."""
    novos = {}
    for obj in meshes:
        for slot in obj.material_slots:
            game_name = game_material_name(slot.material.name.removeprefix("bake_"))
            if game_name not in novos:
                mat = bpy.data.materials.new(f"game_{game_name}")
                mat.use_nodes = True
                # a cor vem toda da textura: fator de cor 1 e material fosco, como o resto do jogo
                bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
                bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
                bsdf.inputs["Metallic"].default_value = 0.0
                bsdf.inputs["Roughness"].default_value = 1.0
                novos[game_name] = mat
            slot.material = novos[game_name]
        merge_duplicate_slots(obj)
    for mat in list(bpy.data.materials):
        if not mat.name.startswith("game_"):
            bpy.data.materials.remove(mat)
    for game_name, mat in novos.items():
        mat.name = game_name
    return sorted(novos)


def clean_mesh_data(meshes):
    """Fica só o UV do jogo (o do bake) e sai a cor por vértice, que no LGPE é dado do shader,
    não cor."""
    for obj in meshes:
        for uv in [uv for uv in obj.data.uv_layers if uv.name != "GameUV"]:
            obj.data.uv_layers.remove(uv)
        obj.data.uv_layers["GameUV"].name = "UVMap"
        for attr in list(obj.data.color_attributes):
            obj.data.color_attributes.remove(attr)


def main():
    src, textures, out, name = parse_args()
    src = src.rstrip("\\/")
    pm = os.path.basename(src)  # pm0010_00
    dex = int(pm[2:6])
    addon_utils.enable(ADDON, default_set=False)

    mdl = os.path.join(src, "mdl")
    getattr(bpy.ops, "import").gfmdl(directory=mdl + os.sep, files=[{"name": f"{pm}.gfbmdl"}])
    clean_scene()
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    # o addon dá a cada malha o nome do osso ANTERIOR ao da skin dela (pm<dex>_00_BodySkin,
    # _LWingSkin...), que é o nome usado pelas trilhas de visibilidade
    bone_names = [b.name for b in arm.data.bones]
    meshes = [o for o in arm.children if o.type == "MESH"]
    bones_by_skin = exclusive_bones(
        {bone_names[bone_names.index(o.name) + 1]: o for o in meshes})
    arm.name = arm.data.name = pm
    # o addon já gira 90° em X (Y para cima -> Z para cima), como o rotate90 do Z-A
    for i, obj in enumerate(meshes):
        obj.name = obj.data.name = pm if len(meshes) == 1 else f"{pm}_{i}"

    faltando = import_animations(arm, os.path.join(src, "anm"), bones_by_skin,
                                 OVERRIDES.get(dex, {}))
    apply_meters(arm, meshes)

    models = os.path.join(out, "models")
    tex = os.path.join(out, "textures", f"{dex:03d}-{name}", "default")
    os.makedirs(models, exist_ok=True)
    os.makedirs(tex, exist_ok=True)
    game_uv(meshes)
    animated_eye = any(f.endswith(f"_{EYE_ANIMATION}.gfbanm")
                       for f in os.listdir(os.path.join(src, "anm")))
    materials = bake_textures(meshes, textures, tex, pm, animated_eye)
    rebuild_materials(meshes)
    clean_mesh_data(meshes)
    for img in list(bpy.data.images):
        bpy.data.images.remove(img)

    glb = os.path.join(models, f"{dex:03d}-{name}.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb, export_format="GLB", export_image_format="NONE",
        export_animations=True, export_animation_mode="ACTIONS",
        export_force_sampling=True, export_optimize_animation_size=True)
    print(f"MATERIAIS {materials}")
    print(f"CONVERTIDO {glb} ({os.path.getsize(glb)} bytes) animações={len(ANIMATIONS) - len(faltando)} faltando={faltando}")


main()
