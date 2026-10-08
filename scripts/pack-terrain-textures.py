"""
Empacota as texturas de desenho do chão (docs/features/047-biomas.md).

Baixa do Poly Haven (CC0) a cor e o mapa de normal (OpenGL) de cada camada
e grava um JPEG por camada em public/assets/textures/terrain/<camada>.jpg:

- R: claro e escuro da cor, dividido pelo brilho médio (o meio do canal é o
  brilho médio — o shader só usa o desenho, a cor vem da paleta do bioma);
- G, B: x e y do mapa de normal.

A ordem e os nomes das camadas têm que bater com `TERRAIN_LAYERS`
(src/view/terrain/terrainLayers.js).

Uso (precisa do Pillow):
    python3 scripts/pack-terrain-textures.py
"""

import io
import json
import os
import urllib.request

from PIL import Image

# camada -> asset do Poly Haven
LAYERS = [
    ("grass", "leafy_grass"),
    ("forest-floor", "forrest_ground_01"),
    ("sand", "sand_01"),
    ("snow", "snow_02"),
    ("dry-ground", "dry_ground_01"),
    ("mud", "brown_mud_02"),
    ("rock", "aerial_rocks_02"),
    ("volcanic-rock", "dark_rock"),
]

# Resolução baixada; a gravada é a metade (média de 2×2, não quebra a
# repetição da borda).
SOURCE_RESOLUTION = "1k"
JPEG_QUALITY = 92

OUTPUT = os.path.join(
    os.path.dirname(__file__), "..", "public", "assets", "textures", "terrain"
)


# O Poly Haven recusa o User-Agent padrão do urllib.
USER_AGENT = "rota151-pack-terrain-textures"


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def map_urls(asset):
    files = json.loads(fetch(f"https://api.polyhaven.com/files/{asset}"))
    color = files["Diffuse"][SOURCE_RESOLUTION]["jpg"]["url"]
    normal = files["nor_gl"][SOURCE_RESOLUTION]["jpg"]["url"]
    return color, normal


def srgb_to_linear(value):
    c = value / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def pack(asset):
    color_url, normal_url = map_urls(asset)
    color = Image.open(io.BytesIO(fetch(color_url))).convert("RGB").reduce(2)
    normal = Image.open(io.BytesIO(fetch(normal_url))).convert("RGB").reduce(2)

    linear = [srgb_to_linear(v) for v in range(256)]
    rgb = color.tobytes()
    brightness = [
        0.2126 * linear[rgb[i]] + 0.7152 * linear[rgb[i + 1]] + 0.0722 * linear[rgb[i + 2]]
        for i in range(0, len(rgb), 3)
    ]
    average = sum(brightness) / len(brightness)
    detail = [min(255, round(b / average * 127.5)) for b in brightness]

    xyz = normal.tobytes()
    packed = bytearray(len(xyz))
    for pixel, d in enumerate(detail):
        packed[pixel * 3] = d
        packed[pixel * 3 + 1] = xyz[pixel * 3]
        packed[pixel * 3 + 2] = xyz[pixel * 3 + 1]
    return Image.frombytes("RGB", color.size, bytes(packed))


def main():
    os.makedirs(OUTPUT, exist_ok=True)
    for layer, asset in LAYERS:
        path = os.path.join(OUTPUT, f"{layer}.jpg")
        pack(asset).save(path, quality=JPEG_QUALITY, subsampling=0)
        print(f"{layer}: {asset} -> {os.path.relpath(path)}")


if __name__ == "__main__":
    main()
