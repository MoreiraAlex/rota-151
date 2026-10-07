"""Converte o modelo de um item (rip em .smd) em um .glb sem textura embutida.

Roda em modo headless (o Blender 5 não importa mais Collada e não lê o FBX 6.1 dos rips,
por isso o .smd é lido direto aqui):

  blender --background --python scripts/blender/convert-item.py -- \
      --out <public/assets/models/items/poke-ball.glb> --part <nome>=<arquivo.smd>[@<osso>] ...

Cada --part vira um nó próprio no .glb (o jogo mostra/esconde ou gira cada um):
  --part fruit_0=ob0501_00_fruits00Skin_vis.smd       malha inteira do arquivo
  --part top=PokeBall.SMD@Up                          só os triângulos presos ao osso Up

Com @<osso>, o pivô do nó fica na posição do osso (ex.: a dobradiça da tampa da pokébola);
sem, fica na origem do modelo. Tudo usa um único material, "body": a textura é aplicada
pelo jogo, então o mesmo .glb serve para todas as variantes.
"""
import bpy, os, sys
from mathutils import Vector


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:]
    out, parts = None, []
    for flag, value in zip(argv[::2], argv[1::2]):
        if flag == "--out":
            out = value
        elif flag == "--part":
            name, src = value.split("=", 1)
            path, _, bone = src.partition("@")
            parts.append((name, path, bone or None))
    return out, parts


def read_smd(path):
    """Lê nós, pose de repouso e triângulos de um .smd (o rip já vem em espaço do modelo)."""
    with open(path, encoding="utf-8", errors="replace") as f:
        lines = [l.strip() for l in f]
    nodes, rest, tris = {}, {}, []
    i = 0
    while i < len(lines):
        section = lines[i]
        i += 1
        if section == "nodes":
            while lines[i] != "end":
                idx, rest_of = lines[i].split(None, 1)
                nodes[int(idx)] = rest_of.rsplit(None, 1)[0].strip('"')
                i += 1
        elif section == "skeleton":
            while lines[i] != "end":
                cols = lines[i].split()
                if cols[0] != "time":
                    rest.setdefault(int(cols[0]), Vector(map(float, cols[1:4])))
                i += 1
        elif section == "triangles":
            while lines[i] != "end":
                tri = []
                for line in lines[i + 1:i + 4]:
                    c = line.split()
                    # sem pesos, o vértice segue o osso da 1ª coluna
                    bone = int(c[10]) if len(c) > 10 and int(c[9]) > 0 else int(c[0])
                    tri.append((Vector(map(float, c[1:4])), Vector(map(float, c[4:7])),
                                (float(c[7]), float(c[8])), bone))
                tris.append(tri)
                i += 4
        if i < len(lines) and lines[i] == "end":
            i += 1
    return nodes, rest, tris


def to_blender(v):
    """O rip é Y-up; o Blender é Z-up (o exportador glTF desfaz isso de volta)."""
    return Vector((v.x, -v.z, v.y))


def build_part(name, tris, pivot, material):
    verts, index, faces, uvs, normals, seen = [], {}, [], [], [], set()
    for tri in tris:
        ids = []
        for pos, _, _, _ in tri:
            key = tuple(round(c, 5) for c in pos)
            if key not in index:
                index[key] = len(verts)
                verts.append(to_blender(pos) - pivot)
            ids.append(index[key])
        if len(set(ids)) < 3 or frozenset(ids) in seen:
            continue  # degenerado ou repetido
        seen.add(frozenset(ids))
        loop = list(tri)
        # a ordem dos vértices tem que concordar com a normal salva no rip
        a, b, c = (verts[j] for j in ids)
        if (b - a).cross(c - a).dot(sum((to_blender(n) for _, n, _, _ in tri), Vector())) < 0:
            ids.reverse()
            loop.reverse()
        faces.append(ids)
        uvs.extend(uv for _, _, uv, _ in loop)
        normals.extend(to_blender(n).normalized() for _, n, _, _ in loop)

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop, uv in zip(uv_layer.data, uvs):
        loop.uv = uv
    mesh.normals_split_custom_set(normals)
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    obj.location = pivot
    bpy.context.scene.collection.objects.link(obj)
    return obj, len(faces)


def main():
    out, parts = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)

    material = bpy.data.materials.new("body")
    material.use_nodes = True
    bsdf = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    # a cor vem toda da textura do jogo: fator 1 e fosco, como nos Pokémon
    bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 1.0

    root = bpy.data.objects.new(os.path.splitext(os.path.basename(out))[0], None)
    bpy.context.scene.collection.objects.link(root)
    for name, path, bone in parts:
        nodes, rest, tris = read_smd(path)
        pivot = Vector()
        if bone:
            bone_id = next(i for i, n in nodes.items() if n == bone)
            tris = [t for t in tris if sum(v[3] == bone_id for v in t) >= 2]
            pivot = to_blender(rest[bone_id])
        obj, count = build_part(name, tris, pivot, material)
        obj.parent = root
        print(f"PARTE {name}: {count} triângulos, pivô {tuple(round(c, 3) for c in pivot)}")

    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_image_format="NONE",
                              export_animations=False, export_materials="EXPORT")
    print(f"CONVERTIDO {out} ({os.path.getsize(out)} bytes)")


main()
