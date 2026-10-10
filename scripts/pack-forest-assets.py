"""
Empacota os modelos de vegetação (docs/features/049-vegetacao-e-floresta.md)
vindos do Stylized Nature MegaKit da Quaternius (CC0,
https://opengameart.org/content/stylized-nature-megakit — versão Standard).

Uso: python3 scripts/pack-forest-assets.py <pasta do MegaKit extraído>
[nomes de saída...] (a pasta é a que tem `glTF/` e `Textures/`; com nomes,
grava só esses modelos — ex.: `acacia-1 acacia-2`)

Para cada modelo (`MODELS`), lê o `.gltf` + `.bin` e grava um `.glb` em
`public/assets/vegetation/megakit/`, com todas as partes (uma por material:
casca e folhas, folhas e pétalas...). A textura de cada parte sai de um de
dois jeitos (`TEXTURES`, pelo nome do material):

- **compartilhada**: reduzida uma vez num arquivo ao lado dos `.glb`, que
  todos os modelos com aquele material apontam (casca e folhas das árvores
  — as UVs repetem a textura, não dá para recortar);
- **recortada**: só o pedaço do atlas que a parte usa, com as UVs ajustadas,
  reduzido e embutido no `.glb` (o atlas `Leaves.png` tem 2048 px e serve
  dezenas de plantas).

Alguns modelos saem de outro DEFORMADO (`SHAPED_MODELS`, docs/features/
050-planicie-e-savana.md): a acácia é a TwistedTree com o tronco esticado e
a copa achatada em guarda-chuva (`umbrella`).

Textura sem alpha vai em JPEG; com alpha, em PNG. O `COLOR_0` do pacote fica
de fora: é uma máscara cinza do shader do MegaKit (vento/sombra), não cor —
no three ela multiplicaria a textura e escureceria a planta.

Precisa do Pillow (`pip install pillow`).
"""

import io
import json
import math
import os
import struct
import sys

from PIL import Image

OUT_DIR = os.path.join(
    os.path.dirname(__file__), '..', 'public', 'assets', 'vegetation', 'megakit'
)
# Folga em volta do pedaço recortado (fração da textura), pro filtro não
# puxar a borda.
MARGIN = 0.01
JPEG_QUALITY = 85

# nome no pacote → nome de saída (ou (nome de saída, {material do pacote:
# material de saída})). Trocar o nome do material separa a casca e a folha de
# cada espécie (cada uma com a própria textura e a própria cor no jogo).
BROADLEAF = {'Bark_NormalTree': 'Bark_Broadleaf', 'Leaves_NormalTree': 'Leaves_Broadleaf'}
ANCIENT = {'Bark_TwistedTree': 'Bark_Ancient', 'Leaves_TwistedTree': 'Leaves_Ancient'}
PINE = {'Bark_NormalTree': 'Bark_Pine', 'Leaves_Pine': 'Leaves_Pine'}
DEAD = {'Bark_DeadTree': 'Bark_Dead'}
ACACIA = {'Bark_TwistedTree': 'Bark_Acacia', 'Leaves_TwistedTree': 'Leaves_Acacia'}
MODELS = {
    **{f'CommonTree_{i}': (f'tree-{i}', BROADLEAF) for i in range(1, 6)},
    **{f'TwistedTree_{i}': (f'ancient-{i}', ANCIENT) for i in range(1, 6)},
    **{f'Pine_{i}': (f'pine-{i}', PINE) for i in range(1, 6)},
    **{f'DeadTree_{i}': (f'dead-{i}', DEAD) for i in (1, 2, 4)},
    'Bush_Common': ('bush-1', {'Leaves_TwistedTree': 'Leaves_Bush'}),
    'Bush_Common_Flowers': ('bush-2', {'Leaves_NormalTree': 'Leaves_BushFlowers'}),
    'Flower_3_Group': 'flower-1',
    'Flower_4_Group': 'flower-2',
    'Fern_1': 'fern',
    'Plant_1': 'plant-1',
    'Plant_1_Big': 'plant-2',
    'Mushroom_Common': 'mushroom',
    'Rock_Medium_1': 'rock-1',
    'Rock_Medium_2': 'rock-2',
    'Rock_Medium_3': 'rock-3',
    'Pebble_Round_1': 'pebble-1',
    'Pebble_Round_3': 'pebble-2',
    'Pebble_Square_1': 'pebble-3',
    'Pebble_Square_5': 'pebble-4',
}

# Forma de guarda-chuva da acácia (`umbrella`), em unidades do modelo (o
# jogo ainda escala a árvore inteira): altura do tronco sem folha, espessura
# da copa, quanto a copa abre para os lados e quanto o tronco afina.
ACACIA_SHAPE = {'trunk': 4.5, 'crown': 2.5, 'spread': 1.0, 'thin': 0.55}

# nome de saída → (modelo do pacote, materiais, forma). Ficam fora do
# `MODELS` porque saem de um modelo que já está lá (a TwistedTree).
SHAPED_MODELS = {
    f'acacia-{i}': (f'TwistedTree_{i}', ACACIA, ACACIA_SHAPE) for i in range(1, 6)
}

# material de saída → ('shared', arquivo, lado, opaco?, textura de Textures/)
# ou ('crop', maior lado). As folhas das árvores e dos arbustos vêm na versão
# BRANCA do pacote (a colorida é uma cor chapada só): o jogo tinge cada
# espécie com a cor dela.
TEXTURES = {
    'Bark_Broadleaf': ('shared', 'bark-twisted.jpg', 512, True, 'Bark_TwistedTree.png'),
    'Bark_Ancient': ('shared', 'bark-twisted.jpg', 512, True, 'Bark_TwistedTree.png'),
    'Bark_Pine': ('shared', 'bark-twisted.jpg', 512, True, 'Bark_TwistedTree.png'),
    'Bark_Acacia': ('shared', 'bark-twisted.jpg', 512, True, 'Bark_TwistedTree.png'),
    'Bark_Dead': ('shared', 'bark-dead.jpg', 512, True, 'Bark_DeadTree.png'),
    'Leaves_Broadleaf': ('shared', 'leaves-broadleaf.png', 512, False, 'Leaves_NormalTree.png'),
    'Leaves_BushFlowers': ('shared', 'leaves-broadleaf.png', 512, False, 'Leaves_NormalTree.png'),
    'Leaves_Ancient': ('shared', 'leaves-round.png', 512, False, 'Leaves_TwistedTree.png'),
    'Leaves_Acacia': ('shared', 'leaves-round.png', 512, False, 'Leaves_TwistedTree.png'),
    'Leaves_Bush': ('shared', 'leaves-round.png', 512, False, 'Leaves_TwistedTree.png'),
    'Leaves_Pine': ('shared', 'leaves-pine.png', 512, False, 'Leaf_Pine.png'),
    'Leaves': ('crop', 512),
    'Flowers': ('crop', 256),
    'Mushrooms': ('crop', 256),
    'Rocks': ('crop', 512),
    'PathRocks': ('crop', 128),
}

COMPONENTS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
FORMATS = {5126: 'f', 5123: 'H', 5125: 'I', 5121: 'B'}


def read_accessor(gltf, data, index):
    accessor = gltf['accessors'][index]
    view = gltf['bufferViews'][accessor['bufferView']]
    size = COMPONENTS[accessor['type']]
    fmt = FORMATS[accessor['componentType']]
    item = struct.calcsize('<' + fmt) * size
    stride = view.get('byteStride', item)
    start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    return [
        list(struct.unpack_from('<' + fmt * size, data, start + i * stride))
        for i in range(accessor['count'])
    ]


def encode(image, opaque):
    out = io.BytesIO()
    if opaque:
        image.convert('RGB').save(out, 'JPEG', quality=JPEG_QUALITY)
    else:
        image.convert('RGBA').save(out, 'PNG', optimize=True)
    return out.getvalue()


def source_image(source_dir, gltf, material):
    index = material['pbrMetallicRoughness']['baseColorTexture']['index']
    uri = gltf['images'][gltf['textures'][index]['source']]['uri']
    return Image.open(os.path.join(source_dir, uri))


def write_shared(source_dir, gltf, material, spec, written):
    _, file_name, side, opaque = spec[:4]
    if file_name in written:
        return
    textures_dir = os.path.join(source_dir, '..', 'Textures')
    image = Image.open(os.path.join(textures_dir, spec[4]))
    image = image.resize((side, side), Image.LANCZOS)
    with open(os.path.join(OUT_DIR, file_name), 'wb') as out:
        out.write(encode(image, opaque))
    written.add(file_name)
    size = os.path.getsize(os.path.join(OUT_DIR, file_name)) // 1024
    print(f'{file_name}  {side}x{side}  {size} KB')


def crop_part(source_dir, gltf, material, uvs, max_size):
    """Recorta o pedaço do atlas que `uvs` usam; devolve (bytes, uvs, opaco)."""
    u0 = max(0.0, min(u for u, _ in uvs) - MARGIN)
    u1 = min(1.0, max(u for u, _ in uvs) + MARGIN)
    v0 = max(0.0, min(v for _, v in uvs) - MARGIN)
    v1 = min(1.0, max(v for _, v in uvs) + MARGIN)
    image = source_image(source_dir, gltf, material)
    width, height = image.size
    image = image.crop(
        (round(u0 * width), round(v0 * height), round(u1 * width), round(v1 * height))
    )
    image.thumbnail((max_size, max_size), Image.LANCZOS)
    remapped = [[(u - u0) / (u1 - u0), (v - v0) / (v1 - v0)] for u, v in uvs]
    opaque = material.get('alphaMode') != 'MASK'
    return encode(image, opaque), remapped, opaque


class GlbWriter:
    def __init__(self):
        self.binary = bytearray()
        self.views = []
        self.accessors = []
        self.images = []
        self.textures = []
        self.materials = []

    def view(self, payload, target=None):
        while len(self.binary) % 4:
            self.binary.append(0)
        view = {'buffer': 0, 'byteOffset': len(self.binary), 'byteLength': len(payload)}
        if target:
            view['target'] = target
        self.binary.extend(payload)
        self.views.append(view)
        return len(self.views) - 1

    def floats(self, rows, kind):
        flat = [value for row in rows for value in row]
        accessor = {
            'bufferView': self.view(struct.pack('<' + 'f' * len(flat), *flat), 34962),
            'componentType': 5126,
            'count': len(rows),
            'type': kind,
        }
        if kind == 'VEC3':
            accessor['min'] = [min(row[i] for row in rows) for i in range(3)]
            accessor['max'] = [max(row[i] for row in rows) for i in range(3)]
        self.accessors.append(accessor)
        return len(self.accessors) - 1

    def indices(self, rows):
        flat = [row[0] for row in rows]
        self.accessors.append({
            'bufferView': self.view(struct.pack('<' + 'I' * len(flat), *flat), 34963),
            'componentType': 5125,
            'count': len(flat),
            'type': 'SCALAR',
        })
        return len(self.accessors) - 1

    def texture(self, image_bytes=None, uri=None, opaque=False):
        if uri:
            self.images.append({'uri': uri})
        else:
            self.images.append({
                'bufferView': self.view(image_bytes),
                'mimeType': 'image/jpeg' if opaque else 'image/png',
            })
        self.textures.append({'source': len(self.images) - 1, 'sampler': 0})
        return len(self.textures) - 1

    def material(self, source, name, texture, opaque):
        material = {
            'name': name,
            'pbrMetallicRoughness': {
                'baseColorTexture': {'index': texture},
                'metallicFactor': 0,
                'roughnessFactor': source['pbrMetallicRoughness'].get('roughnessFactor', 1),
            },
            'doubleSided': source.get('doubleSided', False),
        }
        if not opaque:
            material['alphaMode'] = 'MASK'
            material['alphaCutoff'] = source.get('alphaCutoff', 0.5)
        self.materials.append(material)
        return len(self.materials) - 1

    def save(self, path, name, primitives):
        gltf = {
            'asset': {'version': '2.0', 'generator': 'rota151 pack-forest-assets.py'},
            'scene': 0,
            'scenes': [{'nodes': [0]}],
            'nodes': [{'name': name, 'mesh': 0}],
            'meshes': [{'name': name, 'primitives': primitives}],
            'materials': self.materials,
            'textures': self.textures,
            # Repetir: a casca das árvores repete a textura ao longo do tronco.
            'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
            'images': self.images,
            'accessors': self.accessors,
            'bufferViews': self.views,
            'buffers': [{'byteLength': len(self.binary)}],
        }
        json_bytes = json.dumps(gltf, separators=(',', ':')).encode()
        json_bytes += b' ' * (-len(json_bytes) % 4)
        while len(self.binary) % 4:
            self.binary.append(0)
        total = 12 + 8 + len(json_bytes) + 8 + len(self.binary)
        with open(path, 'wb') as out:
            out.write(struct.pack('<III', 0x46546C67, 2, total))
            out.write(struct.pack('<II', len(json_bytes), 0x4E4F534A))
            out.write(json_bytes)
            out.write(struct.pack('<II', len(self.binary), 0x004E4942))
            out.write(self.binary)


# Fração das folhas mais baixas que fica abaixo da base da copa na acácia
# (um raminho solto lá embaixo não encurta o tronco).
CROWN_BASE_QUANTILE = 0.02
# Até que fração da copa (de baixo para cima) os galhos vão abrindo para os
# lados, na acácia.
SPREAD_RAMP = 0.3
# Faixa de altura (unidades do modelo) que conta como "pé" e "pescoço" do
# tronco, para achar o eixo dele.
TRUNK_SLICE = 0.5


def smoothstep(edge0, edge1, x):
    t = min(1.0, max(0.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def centroid(points):
    return (
        sum(x for x, _, _ in points) / len(points),
        sum(z for _, _, z in points) / len(points),
    )


def umbrella(parts, shape):
    """
    Deforma o modelo inteiro (casca e folhas juntas, para os galhos seguirem
    ligados às folhas) em guarda-chuva: o que fica abaixo da base da copa (a
    altura das folhas mais baixas) vira o tronco, esticado até
    `shape['trunk']` e afinado (`thin`) em volta do eixo dele; o resto é
    achatado na espessura `shape['crown']` e aberto para os lados (`spread`)
    em volta do centro da copa. As normais seguem a deformação (inversa da
    escala de cada eixo).
    """
    leaf_points = [
        point for name, attributes in parts if name.startswith('Leaves')
        for point in attributes['POSITION']
    ]
    bark_points = [
        point for name, attributes in parts if not name.startswith('Leaves')
        for point in attributes['POSITION']
    ]
    leaf_heights = sorted(y for _, y, _ in leaf_points)
    base = leaf_heights[int((len(leaf_heights) - 1) * CROWN_BASE_QUANTILE)]
    top = max(y for _, y, _ in leaf_points + bark_points)
    ramp_top = base + (top - base) * SPREAD_RAMP
    crown_center = centroid(leaf_points)
    # O eixo do tronco: do meio do pé ao meio da casca na base da copa.
    foot = centroid([p for p in bark_points if p[1] < TRUNK_SLICE])
    neck = centroid([p for p in bark_points if abs(p[1] - base) < TRUNK_SLICE])
    trunk_scale = shape['trunk'] / base
    crown_scale = shape['crown'] / (top - base)

    def warp(x, y, z):
        opening = smoothstep(base, ramp_top, y)
        thin = shape['thin'] + (1 - shape['thin']) * opening
        spread = 1 + (shape['spread'] - 1) * opening
        along = min(1.0, max(0.0, y / base))
        axis_x = foot[0] + (neck[0] - foot[0]) * along
        axis_z = foot[1] + (neck[1] - foot[1]) * along
        x = axis_x + (x - axis_x) * thin
        z = axis_z + (z - axis_z) * thin
        if y <= base:
            height, scale_y = y * trunk_scale, trunk_scale
        else:
            height = shape['trunk'] + (y - base) * crown_scale
            scale_y = crown_scale
        point = [
            crown_center[0] + (x - crown_center[0]) * spread,
            height,
            crown_center[1] + (z - crown_center[1]) * spread,
        ]
        side = thin * spread
        return point, (side, scale_y, side)

    for _, attributes in parts:
        positions, normals = [], []
        for (x, y, z), (nx, ny, nz) in zip(attributes['POSITION'], attributes['NORMAL']):
            point, (sx, sy, sz) = warp(x, y, z)
            n = [nx / sx, ny / sy, nz / sz]
            length = math.sqrt(sum(c * c for c in n)) or 1
            positions.append(point)
            normals.append([c / length for c in n])
        attributes['POSITION'] = positions
        attributes['NORMAL'] = normals


def pack(source_dir, name, target, written):
    out_name, renames, shape = (
        (target, {}, None) if isinstance(target, str) else (*target, None)[:3]
    )
    gltf = json.load(open(os.path.join(source_dir, name + '.gltf')))
    data = open(os.path.join(source_dir, gltf['buffers'][0]['uri']), 'rb').read()
    writer = GlbWriter()
    parts = []
    for primitive in gltf['meshes'][0]['primitives']:
        source = gltf['materials'][primitive['material']]
        material_name = renames.get(source['name'], source['name'])
        attributes = {
            key: read_accessor(gltf, data, index)
            for key, index in primitive['attributes'].items()
        }
        parts.append((material_name, attributes))
    if shape:
        umbrella(parts, shape)
    primitives = []
    for primitive, (material_name, attributes) in zip(
        gltf['meshes'][0]['primitives'], parts
    ):
        source = gltf['materials'][primitive['material']]
        spec = TEXTURES[material_name]
        uvs = attributes['TEXCOORD_0']
        if spec[0] == 'shared':
            write_shared(source_dir, gltf, source, spec, written)
            opaque = spec[3]
            texture = writer.texture(uri=spec[1])
        else:
            image_bytes, uvs, opaque = crop_part(source_dir, gltf, source, uvs, spec[1])
            texture = writer.texture(image_bytes=image_bytes, opaque=opaque)
        primitives.append({
            'attributes': {
                'POSITION': writer.floats(attributes['POSITION'], 'VEC3'),
                'NORMAL': writer.floats(attributes['NORMAL'], 'VEC3'),
                'TEXCOORD_0': writer.floats(uvs, 'VEC2'),
            },
            'indices': writer.indices(read_accessor(gltf, data, primitive['indices'])),
            'material': writer.material(source, material_name, texture, opaque),
        })
    path = os.path.join(OUT_DIR, out_name + '.glb')
    writer.save(path, out_name, primitives)
    print(f'{out_name}.glb  {len(primitives)} parte(s)  {os.path.getsize(path) // 1024} KB')


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    kit_dir, only = sys.argv[1], set(sys.argv[2:])
    os.makedirs(OUT_DIR, exist_ok=True)
    written = set()
    jobs = [(name, target) for name, target in MODELS.items()]
    jobs += [(source, (out, renames, shape)) for out, (source, renames, shape) in SHAPED_MODELS.items()]
    for name, target in jobs:
        out_name = target if isinstance(target, str) else target[0]
        if only and out_name not in only:
            continue
        pack(os.path.join(kit_dir, 'glTF'), name, target, written)


if __name__ == '__main__':
    main()
