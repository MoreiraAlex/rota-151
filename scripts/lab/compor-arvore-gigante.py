"""Monta árvores gigantes: os galhos de uma árvore seca com tufos de folhas nas pontas.

docs/features/066-revisao-dos-biomas.md — as árvores gigantes da floresta
pediam um modelo de árvore velha, cheia de galhos, no mesmo estilo das outras
dos pacotes da Quaternius. Nenhum modelo pronto é assim; as árvores secas
(`DeadTree`) têm o esqueleto de galhos. Este script pega cada árvore seca,
acha as pontas dos galhos (os pontos mais altos e mais longe do tronco,
espalhados) e põe em cada uma um tufo das folhas da `NormalTree`, girado e
num tamanho sorteado. Sai um .glb por árvore, com dois materiais:
`NormalTree_Bark` e `NormalTree_Leaves` — o `pack-lab.py` acha as texturas
pelo nome, e o jogo troca as folhas pelas do Let's Go (material com
"leaves" no nome, `LGPE.PACK_LEAVES`).

Roda no Blender, sem janela:

  blender --background --python scripts/lab/compor-arvore-gigante.py -- \\
      --dead <DeadTree_N.fbx>[,<outro>...] --leaves <NormalTree_N.fbx> \\
      --out <pasta> [--clumps <quantos>] [--clump-size <fração da altura>] \\
      [--trunk <quanto engrossa o pé>] [--seed <n>]

- --trunk: o tronco engrossa (no plano) por esse fator no pé, diminuindo até
  não mudar a partir de 40% da altura — tronco de árvore velha, sem
  engordar os galhos.

Depois, empacotar a pasta de saída com o `pack-lab.py` (categoria `tree`).
"""
import bpy, math, os, random, sys
from mathutils import Vector

BARK = "NormalTree_Bark"
LEAVES = "NormalTree_Leaves"


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:]
    args = {"clumps": "10", "clump-size": "0.36", "trunk": "1.8", "seed": "151"}
    for flag, value in zip(argv[::2], argv[1::2]):
        args[flag.lstrip("-")] = value
    for required in ("dead", "leaves", "out"):
        if required not in args:
            raise SystemExit(f"faltou --{required}")
    return args


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_joined(path):
    """Importa o FBX e junta as malhas num objeto só, com a escala aplicada."""
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    imported = [o for o in bpy.context.scene.objects if o not in before]
    meshes = [o for o in imported if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for mesh in meshes:
        mesh.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for other in [o for o in imported if o.type != "MESH"]:
        bpy.data.objects.remove(other, do_unlink=True)
    return obj


def material_named(name):
    return bpy.data.materials.get(name) or bpy.data.materials.new(name)


def only_material(obj, name):
    obj.data.materials.clear()
    obj.data.materials.append(material_named(name))
    for polygon in obj.data.polygons:
        polygon.material_index = 0


def leaves_template(path):
    """As folhas da árvore (as faces do material de folha), centradas no meio."""
    obj = import_joined(path)
    leaf_slots = {
        i for i, slot in enumerate(obj.material_slots)
        if slot.material and "leaves" in slot.material.name.lower()
    }
    if not leaf_slots:
        raise SystemExit(f"{path}: nenhum material de folha")
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    for polygon in obj.data.polygons:
        polygon.select = polygon.material_index not in leaf_slots
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.delete(type="FACE")
    bpy.ops.object.mode_set(mode="OBJECT")
    only_material(obj, LEAVES)
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    low = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    high = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    center = (low + high) / 2
    for vertex in obj.data.vertices:
        vertex.co -= center
    obj.name = "leaves-template"
    return obj, max(high - low)


def thicken_trunk(obj, factor):
    """Engrossa o tronco: perto do pé, afasta os vértices do eixo do tronco."""
    points = [v.co for v in obj.data.vertices]
    base_z = min(p.z for p in points)
    height = max(p.z for p in points) - base_z
    foot = [p for p in points if p.z < base_z + height * 0.05]
    axis = sum(foot, Vector()) / max(len(foot), 1)
    for vertex in obj.data.vertices:
        rise = (vertex.co.z - base_z) / height
        grow = 1 + (factor - 1) * max(0.0, 1 - rise / 0.4) ** 1.5
        vertex.co.x = axis.x + (vertex.co.x - axis.x) * grow
        vertex.co.y = axis.y + (vertex.co.y - axis.y) * grow


def branch_tips(obj, count, min_gap):
    """As pontas dos galhos: pontos altos e longe do tronco, espalhados."""
    points = [obj.matrix_world @ v.co for v in obj.data.vertices]
    base_z = min(p.z for p in points)
    height = max(p.z for p in points) - base_z
    foot = [p for p in points if p.z < base_z + height * 0.05]
    axis = sum(foot, Vector()) / max(len(foot), 1)
    scored = []
    for p in points:
        if p.z < base_z + height * 0.45:
            continue
        reach = math.hypot(p.x - axis.x, p.y - axis.y)
        scored.append((reach + (p.z - base_z) * 0.7, p))
    scored.sort(key=lambda item: -item[0])
    pool = [p for _, p in scored[: max(len(scored) * 2 // 5, count)]]
    tips = [pool[0]]
    while len(tips) < count:
        best, best_gap = None, -1.0
        for p in pool:
            gap = min((p - t).length for t in tips)
            if gap > best_gap:
                best, best_gap = p, gap
        if best_gap < min_gap * height:
            break
        tips.append(best)
    return tips, height


def compose(dead_path, template, template_size, args, rng, out_dir):
    tree = import_joined(dead_path)
    only_material(tree, BARK)
    thicken_trunk(tree, float(args["trunk"]))
    tips, height = branch_tips(tree, int(args["clumps"]), 0.16)
    target = float(args["clump-size"]) * height
    parts = [tree]
    for tip in tips:
        clump = template.copy()
        clump.data = template.data.copy()
        bpy.context.scene.collection.objects.link(clump)
        size = target / template_size * (0.8 + rng.random() * 0.4)
        clump.scale = (size, size, size * (0.75 + rng.random() * 0.2))
        clump.rotation_euler = (0, 0, rng.random() * math.tau)
        clump.location = tip + Vector((0, 0, target * 0.15))
        parts.append(clump)
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = tree
    bpy.ops.object.join()
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    joined = bpy.context.view_layer.objects.active
    for slot in joined.material_slots:
        if slot.material and slot.material.name.startswith(LEAVES):
            slot.material = material_named(LEAVES)
        elif slot.material and slot.material.name.startswith(BARK):
            slot.material = material_named(BARK)
    pack = "MK" if "MegaKit" in dead_path or "megakit" in dead_path else ""
    name = "GiantTree_" + pack + os.path.splitext(os.path.basename(dead_path))[0].replace("DeadTree_", "")
    bpy.ops.object.select_all(action="DESELECT")
    joined.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(out_dir, name + ".glb"),
        export_format="GLB",
        use_selection=True,
        export_materials="EXPORT",
    )
    print(f"{name}: {len(tips)} tufos")
    bpy.data.objects.remove(joined, do_unlink=True)


def main():
    args = parse_args()
    rng = random.Random(int(args["seed"]))
    os.makedirs(args["out"], exist_ok=True)
    for dead in args["dead"].split(","):
        clear_scene()
        template, size = leaves_template(args["leaves"])
        template.hide_set(True)
        compose(dead, template, size, args, rng, args["out"])


main()
