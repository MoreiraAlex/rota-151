"""Converte modelos de fora (FBX, GLB/glTF, OBJ) num pacote do laboratório de biomas.

docs/features/066-revisao-dos-biomas.md — o pacote sai no formato do LGPE
(`public/assets/vegetation/lgpe/`): um .glb por modelo (só a malha, em metros,
centro no meio e base no chão), as texturas de cor em PNG e o `manifest.json`
(categoria, tamanho e a textura de cada material). O lab junta os pacotes da
lista `public/assets/lab/packs.json` aos modelos do LGPE, e eles aparecem no
F2 → Vegetação → Modelos de cada tipo.

Roda no Blender, sem janela:

  blender --background --python scripts/lab/pack-lab.py -- \\
      --src <arquivo ou pasta> --pack <id> --category <categoria> \\
      [--match <trecho do nome>] [--height <m> | --scale <x>] [--label <nome>] \\
      [--textures <pasta>] [--recolor "<trecho>=#cor:força,..."] \\
      [--cartoon "blur=<f>,flat=<f>,levels=<n>,gamma=<f>,saturation=<f>,bright=<f>"] \\
      [--out public/assets/lab] [--max-texture 1024]

- --src: um arquivo ou uma pasta (todos os .fbx/.glb/.gltf/.obj dela).
- --category: tree, bush, plant, tuft, tall-grass, flower, rock ou street (a
  mesma categoria do manifesto do LGPE; decide em que tipo de vegetação o
  modelo pode entrar e como o vento mexe nele; `street` é objeto de cidade —
  o colisor sai com casco e caixa no chão, como o boneco do campo de treino,
  docs/features/067-campo-de-treino-e-avisos-de-nivel.md).
- --match: só os arquivos cujo nome tem esse trecho (ex.: CommonTree).
- --height: põe cada modelo nessa altura (m). Sem ele, --scale (padrão 1)
  multiplica o tamanho de importação.
- --textures: onde procurar as imagens que o modelo cita e não estão junto
  dele (sem ele, a pasta do arquivo, a de cima e as pastas "textures" delas).
  Material sem textura ligada usa a imagem com o nome dele, se houver.
- --recolor: puxa a textura dos materiais cujo nome tem o trecho para a cor
  (força 0 a 1), mantendo o claro e escuro — ex.:
  "Leaves=#4a7a32:0.85,Bark=#5b4a3d:0.5" (folhas de outono verdes, casca
  avermelhada marrom). Sai numa textura própria.
- --cartoon: deixa a textura de cor com cara de desenho (docs/features/067-
  campo-de-treino-e-avisos-de-nivel.md — o boneco de treino veio com
  texturas de foto). Cada chave é opcional: `blur` borra o grão da foto (o
  raio, em fração do lado da textura); `flat` puxa cada pixel para a cor
  média da textura (0 = como está, 1 = cor chapada); `levels` divide a luz
  em N faixas (sombreado de desenho; 0 = sem faixas); `gamma` clareia
  (acima de 1) ou escurece (abaixo) mais os tons escuros que os claros —
  textura de foto escura fica clara sem estourar o que já era claro;
  `saturation` multiplica a saturação; `bright` multiplica o brilho. Ordem:
  borrar, chapar, faixas, gama, saturação e brilho. Sai numa textura
  própria.
- Rodar de novo com o mesmo --pack junta ao pacote (o mesmo id substitui).

Cada arquivo vira um modelo (as malhas dele juntas). A cor de cada material
vem da primeira textura que chega na "Base Color" do Principled BSDF; com o
alfa ligado na textura, o recorte (cutoff) fica em 0,5.
"""
import bpy, json, os, re, sys
import numpy as np

CATEGORIES = {"tree", "bush", "plant", "tuft", "tall-grass", "flower", "rock", "street"}
EXTENSIONS = (".fbx", ".glb", ".gltf", ".obj")
CUTOFF = 0.5


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:]
    args = {"out": "public/assets/lab", "scale": "1", "max-texture": "1024"}
    for flag, value in zip(argv[::2], argv[1::2]):
        args[flag.lstrip("-")] = value
    for required in ("src", "pack", "category"):
        if required not in args:
            raise SystemExit(f"faltou --{required}")
    if args["category"] not in CATEGORIES:
        raise SystemExit(f"--category deve ser uma de {sorted(CATEGORIES)}")
    return args


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def sources_of(src, match):
    if os.path.isdir(src):
        files = [os.path.join(src, name) for name in sorted(os.listdir(src))]
    else:
        files = [src]
    files = [f for f in files if f.lower().endswith(EXTENSIONS)]
    if match:
        files = [f for f in files if match.lower() in os.path.basename(f).lower()]
    return files


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_file(path):
    lower = path.lower()
    if lower.endswith(".fbx"):
        bpy.ops.import_scene.fbx(filepath=path)
    elif lower.endswith((".glb", ".gltf")):
        bpy.ops.import_scene.gltf(filepath=path)
    else:
        bpy.ops.wm.obj_import(filepath=path)


def mesh_objects():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def join_meshes(meshes):
    """As malhas do arquivo num objeto só, com as transformações aplicadas."""
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    # Solta dos pais mantendo a posição, aplica tudo e junta.
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    return bpy.context.view_layer.objects.active


def bounds(obj):
    xs, ys, zs = zip(*[(v.co.x, v.co.y, v.co.z) for v in obj.data.vertices])
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)


def normalize(obj, height, scale):
    """Tamanho pedido, centro no meio (x, y) e base no chão (z = 0)."""
    x0, x1, y0, y1, z0, z1 = bounds(obj)
    factor = height / max(z1 - z0, 1e-6) if height else scale
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    for v in obj.data.vertices:
        v.co.x = (v.co.x - cx) * factor
        v.co.y = (v.co.y - cy) * factor
        v.co.z = (v.co.z - z0) * factor
    obj.data.update()
    x0, x1, y0, y1, z0, z1 = bounds(obj)
    # No jogo o Y é para cima: [largura, altura, profundidade].
    return [round(x1 - x0, 3), round(z1 - z0, 3), round(y1 - y0, 3)]


def find_image(socket, seen=None):
    """A primeira textura que chega nessa entrada (passando por outros nós)."""
    seen = seen or set()
    for link in socket.links:
        node = link.from_node
        if node in seen:
            continue
        seen.add(node)
        if node.type == "TEX_IMAGE" and node.image:
            return node.image, link.from_socket.name == "Alpha"
        for inp in node.inputs:
            found = find_image(inp, seen)
            if found:
                return found
    return None


def color_and_alpha(material):
    if not material or not material.use_nodes:
        return None, False
    for node in material.node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            color = find_image(node.inputs["Base Color"])
            alpha = node.inputs["Alpha"].is_linked
            return (color[0] if color else None), alpha
    return None, False


def texture_dirs(path, extra):
    """Onde procurar as imagens citadas pelo arquivo `path`."""
    here = os.path.dirname(os.path.abspath(path))
    dirs = [extra] if extra else []
    for base in (here, os.path.dirname(here)):
        dirs.append(base)
        if os.path.isdir(base):
            dirs += [
                os.path.join(base, name)
                for name in os.listdir(base)
                if name.lower() in ("textures", "texture", "tex")
            ]
    return [d for d in dirs if d and os.path.isdir(d)]


def ensure_image_data(image, dirs):
    """Acha a imagem pelo nome nas pastas `dirs` quando o caminho dela não existe."""
    if image.has_data or image.packed_file:
        return True
    name = os.path.basename(bpy.path.abspath(image.filepath) or image.name)
    name = re.sub(r"\.\d{3}$", "", name)
    for folder in dirs:
        candidate = os.path.join(folder, name)
        if os.path.isfile(candidate):
            image.filepath = candidate
            image.reload()
            return image.has_data or image.size[0] > 0
    return False


def image_by_material_name(material, dirs):
    """Sem textura ligada: a imagem com o nome do material (ex.: o material
    NormalTree_Bark e o arquivo NormalTree_Bark.png), ou com o nome no
    plural (o material Rock e o arquivo Rocks.png), se houver."""
    base = re.sub(r"\.\d{3}$", "", material.name)
    for name in (base, base + "s"):
        for folder in dirs:
            for ext in (".png", ".jpg", ".jpeg", ".tga"):
                candidate = os.path.join(folder, name + ext)
                if os.path.isfile(candidate):
                    return bpy.data.images.load(candidate, check_existing=True)
    return None


def parse_recolor(text):
    """'Leaves=#4a7a32:0.85,Bark=#5b4a3d:0.5' → [(trecho, (r, g, b), força)]."""
    rules = []
    for part in filter(None, (text or "").split(",")):
        key, _, spec = part.partition("=")
        color, _, amount = spec.partition(":")
        color = color.lstrip("#")
        rgb = tuple(int(color[i:i + 2], 16) / 255 for i in (0, 2, 4))
        rules.append((key.strip().lower(), rgb, float(amount or 1)))
    return rules


def recolor_of(material, rules):
    for key, rgb, amount in rules:
        if key in material.name.lower():
            return rgb, amount
    return None


def apply_recolor(image, recolor):
    """Puxa os pixels para a cor mantendo o brilho (a luma) de cada um."""
    rgb, amount = recolor
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(-1, 4)
    luma = pixels[:, :3] @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    target = np.array(rgb, dtype=np.float32)
    hue = target / max(float(target @ np.array([0.2126, 0.7152, 0.0722])), 1e-3)
    pixels[:, :3] = pixels[:, :3] * (1 - amount) + np.outer(luma, hue) * amount
    image.pixels[:] = np.clip(pixels, 0, 1).ravel()


CARTOON_DEFAULTS = {
    "blur": 0,
    "flat": 0,
    "levels": 0,
    "gamma": 1,
    "saturation": 1,
    "bright": 1,
}
LUMA = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)


def parse_cartoon(text):
    """'blur=0.02,flat=0.4,levels=4' → dicionário com os padrões; sem texto, None."""
    if not text:
        return None
    params = dict(CARTOON_DEFAULTS)
    for part in filter(None, text.split(",")):
        key, _, value = part.partition("=")
        key = key.strip()
        if key not in CARTOON_DEFAULTS:
            raise SystemExit(f"--cartoon: chave desconhecida {key}")
        params[key] = float(value)
    return params


def box_blur(rgb, radius):
    """Borra (média em caixa, duas passadas em cada eixo ≈ gaussiana)."""
    if radius < 1:
        return rgb
    for axis in (0, 1):
        for _ in range(2):
            pad = [(0, 0)] * 3
            pad[axis] = (radius + 1, radius)
            padded = np.pad(rgb, pad, mode="edge")
            summed = np.cumsum(padded, axis=axis, dtype=np.float64)
            size = rgb.shape[axis]
            upper = np.take(summed, np.arange(2 * radius + 1, 2 * radius + 1 + size), axis=axis)
            lower = np.take(summed, np.arange(0, size), axis=axis)
            rgb = ((upper - lower) / (2 * radius + 1)).astype(np.float32)
    return rgb


def apply_cartoon(image, params):
    """Cara de desenho na textura de cor (ver --cartoon)."""
    width, height = image.size
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(height, width, 4)
    rgb = pixels[:, :, :3]
    rgb = box_blur(rgb, int(round(params["blur"] * max(width, height))))
    if params["flat"] > 0:
        mean = rgb.reshape(-1, 3).mean(axis=0)
        rgb = rgb * (1 - params["flat"]) + mean * params["flat"]
    luma = np.maximum(rgb @ LUMA, 1e-4)
    if params["levels"] >= 2:
        steps = params["levels"] - 1
        banded = np.round(luma * steps) / steps
        rgb = rgb * (np.maximum(banded, 1 / (2 * steps)) / luma)[:, :, None]
    if params["gamma"] != 1:
        rgb = np.power(np.clip(rgb, 0, 1), 1 / params["gamma"])
    luma = np.maximum(rgb @ LUMA, 1e-4)
    rgb = luma[:, :, None] + (rgb - luma[:, :, None]) * params["saturation"]
    rgb = rgb * params["bright"]
    pixels[:, :, :3] = np.clip(rgb, 0, 1)
    image.pixels[:] = pixels.ravel()


def save_texture(image, name, folder, max_side, recolor=None, cartoon=None):
    path = os.path.join(folder, f"{name}.png")
    copy = image.copy()
    width, height = copy.size
    if max(width, height) > max_side:
        ratio = max_side / max(width, height)
        copy.scale(max(1, int(width * ratio)), max(1, int(height * ratio)))
    if recolor:
        apply_recolor(copy, recolor)
    if cartoon:
        apply_cartoon(copy, cartoon)
    copy.filepath_raw = path
    copy.file_format = "PNG"
    copy.save()
    # Alfa só quando algum pixel é transparente de fato (o JPEG chega com
    # um canal alfa todo opaco).
    has_alpha = (
        copy.channels == 4
        and image.alpha_mode != "NONE"
        and float(np.array(copy.pixels[:], dtype=np.float32)[3::4].min()) < 0.99
    )
    size = list(copy.size)
    bpy.data.images.remove(copy)
    # glTF: o UV já vem de cima para baixo (o jogo não vira, ao contrário
    # das texturas do LGPE).
    return {
        "file": f"textures/{name}.png",
        "width": size[0],
        "height": size[1],
        "alpha": has_alpha,
        "flipY": False,
    }


def main():
    args = parse_args()
    pack, category = args["pack"], args["category"]
    out = os.path.join(args["out"], pack)
    os.makedirs(os.path.join(out, "props"), exist_ok=True)
    os.makedirs(os.path.join(out, "textures"), exist_ok=True)
    manifest_path = os.path.join(out, "manifest.json")
    manifest = {"source": pack, "props": {}, "textures": {}}
    if os.path.exists(manifest_path):
        with open(manifest_path) as f:
            manifest.update(json.load(f))
    height = float(args["height"]) if "height" in args else None
    scale = float(args["scale"])
    max_side = int(args["max-texture"])
    recolor_rules = parse_recolor(args.get("recolor"))
    cartoon = parse_cartoon(args.get("cartoon"))

    files = sources_of(args["src"], args.get("match"))
    if not files:
        raise SystemExit("nenhum arquivo .fbx/.glb/.gltf/.obj achado")
    for path in files:
        clear_scene()
        import_file(path)
        meshes = mesh_objects()
        if not meshes:
            print(f"sem malha: {path}")
            continue
        obj = join_meshes(meshes)
        size = normalize(obj, height, scale)
        base = os.path.splitext(os.path.basename(path))[0]
        prop_id = f"{pack}-{slug(base)}"

        materials = {}
        for material in obj.data.materials:
            if not material or material.name in materials:
                continue
            image, alpha = color_and_alpha(material)
            maps = {}
            dirs = texture_dirs(path, args.get("textures"))
            if image and not ensure_image_data(image, dirs):
                print(f"textura não achada: {image.name} ({path})")
                image = None
            if not image:
                image = image_by_material_name(material, dirs)
            if image:
                recolor = recolor_of(material, recolor_rules)
                texture = f"{pack}-{slug(os.path.splitext(image.name)[0])}"
                if recolor:
                    texture += "-" + "".join(f"{round(c * 255):02x}" for c in recolor[0])
                if cartoon:
                    texture += "-cartoon"
                # Com --cartoon, refaz sempre (os números podem ter mudado).
                if cartoon or texture not in manifest["textures"]:
                    manifest["textures"][texture] = save_texture(
                        image,
                        texture,
                        os.path.join(out, "textures"),
                        max_side,
                        recolor,
                        cartoon,
                    )
                maps["Texture01"] = texture
                alpha = alpha or manifest["textures"][texture]["alpha"]
            materials[material.name] = {
                "shader": "Lab",
                "maps": maps,
                "cutoff": CUTOFF if alpha else None,
                "doubleSided": not material.use_backface_culling or bool(alpha),
                "shadowColor": None,
                "rimColor": None,
                "rim": None,
                "lightColor": None,
                "greenColor": None,
            }

        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=os.path.join(out, "props", f"{prop_id}.glb"),
            export_format="GLB",
            use_selection=True,
            export_yup=True,
            export_apply=True,
            export_materials="EXPORT",
            export_image_format="NONE",
            export_animations=False,
            export_skins=False,
            export_morph=False,
        )
        label = f"{args.get('label', pack)} — {base}"
        manifest["props"][prop_id] = {
            "label": label,
            "category": category,
            "file": f"props/{prop_id}.glb",
            "size": size,
            "materials": materials,
        }
        print(f"{prop_id}: {size[0]} × {size[1]} × {size[2]} m, {len(materials)} materiais")

    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    packs_path = os.path.join(args["out"], "packs.json")
    packs = []
    if os.path.exists(packs_path):
        with open(packs_path) as f:
            packs = json.load(f)
    if pack not in packs:
        packs.append(pack)
    with open(packs_path, "w") as f:
        json.dump(packs, f, indent=2)
        f.write("\n")
    print(f"{len(manifest['props'])} modelos no pacote {pack} → {out}")


main()
