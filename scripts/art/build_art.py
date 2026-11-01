"""
Fakemon art pipeline.

    python3 -I scripts/art/build_art.py path/to/Helado_Region_Fakedex.sb3

1. Reads the Scratch project (a zip) and its DEX sprite costumes.
2. Skips costumes that are regional forms of existing franchise creatures, and designs built
   on franchise trademarks (EXCLUDE), so the game only ships original creature art.
3. Strips the Fakedex page decorations (name banner, notes text, type icons, sketches).
4. Writes trimmed, transparent WebP files to public/art/creatures/<name>.webp plus a catalog JSON
   (including the type icons detected on each Fakedex page) for reference.

Requires: rsvg-convert, Pillow, numpy, scipy.
"""
import io, json, os, re, subprocess, sys, tempfile, zipfile
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'art', 'creatures')
EXCLUDE = {'DUPEDILLO', 'TRIKGLYPT'}  # built on a franchise ball trademark
TYPE_COLORS = {'#c5c5c5': 'normal', '#ff5600': 'fire', '#19ff00': 'grass', '#0d6fff': 'water', '#28e8ff': 'ice',
               '#ffbc00': 'electric', '#b36100': 'ground', '#8d7549': 'rock', '#b3b7e8': 'flying', '#ff34dc': 'psychic',
               '#ff3333': 'fighting', '#3e5553': 'steel', '#4b4c67': 'dark', '#9200de': 'poison', '#3a3970': 'ghost',
               '#8ba826': 'bug', '#5418bb': 'dragon', '#f451ae': 'fairy'}


def key(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


def strip_svg(s):
    types = []
    s = re.sub(r'<text.*?</text>', '', s, flags=re.S)
    s = re.sub(r'<path d="M[-\d.,]+v[-\d.]+h[-\d.]+v[-\d.]+z" fill="#212121"[^>]*/>', '', s, count=1)

    def note(seg):
        for c in re.findall(r'fill="(#[0-9a-fA-F]{6})"', seg):
            t = TYPE_COLORS.get(c.lower())
            if t and t not in types:
                types.append(t)

    def kill_group(m):
        g = m.group(0)
        if 'fill="#212121"' in g and 'c0,-8.46704' in g and len(g) < 6000:
            note(g)
            return ''
        return g
    s = re.sub(r'<g [^>]*>(?:(?!<g[ >]).)*?</g>', kill_group, s, flags=re.S)

    def kill_loose(m):
        note(m.group(0))
        return ''
    s = re.sub(r'<path d="M[-\d.,]+c0,-8\.46704[^"]*" fill-opacity="0\.2\d*" fill="#000000"/>(?:<path [^>]*/>){1,8}?(?=<path d="M[-\d.,]+c0,-8\.46704[^"]*" fill-opacity|<g|</g)', kill_loose, s)
    return s, types


def raster_clean(png_bytes):
    im = np.array(Image.open(io.BytesIO(png_bytes)).convert('RGBA')).astype(np.int32)
    a = im[..., 3] > 20
    lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=3))
    sizes = ndimage.sum(a, lab, range(1, n + 1))
    main = int(np.argmax(sizes)) + 1
    rgb = im[..., :3]
    dark = (abs(rgb[..., 0] - 33) < 10) & (abs(rgb[..., 1] - 33) < 10) & (abs(rgb[..., 2] - 33) < 10) & a
    gray = ((rgb.max(-1) - rgb.min(-1)) < 25) & a
    sl = ndimage.find_objects(lab)
    mys, mxs = sl[main - 1]
    H, W = a.shape
    padY, padX = int(0.03 * H), int(0.03 * W)
    total = a.sum()
    keep = np.zeros_like(a)
    for i in range(1, n + 1):
        comp = (lab == i) & a
        px = comp.sum()
        ys, xs = sl[i - 1]
        h, w = ys.stop - ys.start, xs.stop - xs.start
        darkfrac = (dark & comp).sum() / max(px, 1)
        grayfrac = (gray & comp).sum() / max(px, 1)
        fill = px / max(h * w, 1)
        overlaps = not (ys.stop < mys.start - padY or ys.start > mys.stop + padY or xs.stop < mxs.start - padX or xs.start > mxs.stop + padX)
        if i != main:
            if fill > 0.93 and px > 400: continue
            if w > 3 * h and ys.start < 0.15 * H and fill > 0.7: continue
            if not overlaps and (px < 0.03 * total or grayfrac > 0.5): continue
            if ys.stop <= mys.start + 0.02 * H and px < 0.01 * total: continue
            if darkfrac > 0.35 and px < 0.08 * total: continue
            if px < 0.004 * sizes.max() and darkfrac > 0.2: continue
        elif darkfrac > 0.85 and fill > 0.9:
            continue
        keep |= comp
    im[..., 3] = np.where(keep, im[..., 3], 0)
    ys, xs = np.where(keep)
    im = im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    out = Image.fromarray(im.astype(np.uint8), 'RGBA')
    out.thumbnail((640, 640), Image.LANCZOS)
    return out


def main(sb3):
    os.makedirs(OUT, exist_ok=True)
    z = zipfile.ZipFile(sb3)
    project = json.loads(z.read('project.json'))
    targets = {t['name']: t for t in project['targets']}
    regional = {c['name'] for c in targets.get('REGIONAL FORMS', {'costumes': []})['costumes']}
    catalog = []
    with tempfile.TemporaryDirectory() as tmp:
        for c in targets['DEX']['costumes']:
            if c['name'] in regional or c['name'] in EXCLUDE:
                continue
            svg, types = strip_svg(z.read(c['md5ext']).decode('utf8'))
            src = os.path.join(tmp, 'x.svg')
            open(src, 'w').write(svg)
            png = subprocess.run(['rsvg-convert', '-z', '3', src], capture_output=True, check=True).stdout
            img = raster_clean(png)
            k = key(c['name'])
            img.save(os.path.join(OUT, k + '.webp'), 'WEBP', quality=88, method=6)
            catalog.append({'key': k, 'name': c['name'].title(), 'fakedexTypes': types, 'size': img.size})
            print(f"{k:16s} {img.size} {types}")
    json.dump(catalog, open(os.path.join(ROOT, 'src', 'cards', 'fakedex-catalog.json'), 'w'), indent=1)
    print(f"{len(catalog)} creatures written to {OUT}")


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'assets-src', 'Helado_Region_Fakedex.sb3'))
