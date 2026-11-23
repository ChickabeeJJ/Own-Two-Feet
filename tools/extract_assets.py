"""Cut the uploaded art sheets into game assets.
- materials v2 (image 3): every tile except the Stone column -> seamless textures
- materials v1 (image 1): Stone column (+ built stone, bark, foliage, ore) -> seamless textures
- props sheet (image 2): props, block icons, interface icons, effects -> transparent sprites
Usage: python3 tools/extract_assets.py <img1> <img2> <img3> <outdir>
"""
import sys, os, json
import numpy as np
from PIL import Image

def load(p): return np.asarray(Image.open(p).convert('RGB')).astype(np.float32)

def runs(profile, thr, minlen):
    out, start = [], None
    for i, v in enumerate(profile):
        if v > thr and start is None: start = i
        if v <= thr and start is not None:
            if i - start >= minlen: out.append((start, i))
            start = None
    if start is not None and len(profile) - start >= minlen: out.append((start, len(profile)))
    return out

def grid(img, x0, y0, x1, y1, minlen=60, thr_frac=0.45):
    reg = img[y0:y1, x0:x1]
    bg = np.median(np.concatenate([reg[:4].reshape(-1, 3), reg[-4:].reshape(-1, 3)]), axis=0)
    mask = (np.abs(reg - bg).sum(axis=2) > 40)
    cols = runs(mask.mean(axis=0), thr_frac * mask.mean(axis=0).max(), minlen)
    rows = runs(mask.mean(axis=1), thr_frac * mask.mean(axis=1).max(), minlen)
    return [(x0 + a, x0 + b) for a, b in cols], [(y0 + a, y0 + b) for a, b in rows]

def seamless(tile):
    h, w, _ = tile.shape
    r = np.roll(np.roll(tile, h // 2, 0), w // 2, 1)
    yy, xx = np.mgrid[0:h, 0:w]
    u = np.abs(xx / (w - 1) * 2 - 1); v = np.abs(yy / (h - 1) * 2 - 1)
    m = np.clip((1 - np.maximum(u, v)) / 0.45, 0, 1)
    m = m * m * (3 - 2 * m)
    return tile * m[..., None] + r * (1 - m[..., None])

def cut_tile(img, xr, yr, inset=0.13, size=128):
    (x0, x1), (y0, y1) = xr, yr
    w, h = x1 - x0, y1 - y0
    t = img[int(y0 + h * inset):int(y1 - h * inset), int(x0 + w * inset):int(x1 - w * inset)]
    im = Image.fromarray(t.astype(np.uint8)).resize((size, size), Image.LANCZOS)
    return seamless(np.asarray(im).astype(np.float32))

def save(arr, path, alpha=None):
    a = np.clip(arr, 0, 255).astype(np.uint8)
    if alpha is not None:
        a = np.dstack([a, np.clip(alpha * 255, 0, 255).astype(np.uint8)])
        Image.fromarray(a, 'RGBA').save(path, optimize=True)
    else:
        Image.fromarray(a).save(path, optimize=True)

def sprite(img, box, out, pad=6, lo=14, hi=52, glow=False):
    """cut a prop off the dark board: alpha from distance to the local background, then un-premultiply"""
    x0, y0, x1, y1 = box
    reg = img[y0:y1, x0:x1]
    ring = np.concatenate([reg[:3].reshape(-1, 3), reg[-3:].reshape(-1, 3), reg[:, :3].reshape(-1, 3), reg[:, -3:].reshape(-1, 3)])
    bg = np.median(ring, axis=0)
    d = np.sqrt(((reg - bg) ** 2).sum(axis=2))
    if glow:  # light sources: brightness above the board is coverage
        lum = (reg - bg).clip(0).max(axis=2)
        a = np.clip(lum / 255 * 1.6, 0, 1)
    else:
        a = np.clip((d - lo) / (hi - lo), 0, 1)
    a3 = np.maximum(a, 1e-3)[..., None]
    col = (reg - bg * (1 - a3)) / a3
    ys, xs = np.where(a > 0.04)
    if len(xs) == 0: return None
    bx0, bx1, by0, by1 = max(0, xs.min() - pad), min(reg.shape[1], xs.max() + pad), max(0, ys.min() - pad), min(reg.shape[0], ys.max() + pad)
    save(col[by0:by1, bx0:bx1], out, a[by0:by1, bx0:bx1])
    return (int(bx1 - bx0), int(by1 - by0))

def main(p1, p2, p3, outdir):
    os.makedirs(outdir + '/tex', exist_ok=True); os.makedirs(outdir + '/props', exist_ok=True)
    os.makedirs(outdir + '/icons', exist_ok=True); os.makedirs(outdir + '/fx', exist_ok=True)
    biomes = ['meadow', 'glass', 'hollow', 'ember', 'frost']
    meta = {}
    # ---- image 3: materials v2
    m3 = load(p3)
    cols, rows = grid(m3, 225, 220, 960, 815)
    print('img3 grid', cols, rows)
    names3 = ['groundA', 'groundB', 'rock', 'stone_x', 'detail', 'accent']
    for ri, (yr) in enumerate(rows[:5]):
        for ci, xr in enumerate(cols[:6]):
            if names3[ci] == 'stone_x': continue
            save(cut_tile(m3, xr, yr), f'{outdir}/tex/{biomes[ri]}_{names3[ci]}.png')
    bcols, brows = grid(m3, 985, 250, 1320, 665)
    print('img3 build', bcols, brows)
    build3 = [['plank', 'brick', 'stone_x'], ['plaster', 'obsidian', 'lava'], ['sand', 'snow', 'ice']]
    for ri, yr in enumerate(brows[:3]):
        for ci, xr in enumerate(bcols[:3]):
            if build3[ri][ci] == 'stone_x': continue
            save(cut_tile(m3, xr, yr, inset=0.1), f'{outdir}/tex/build_{build3[ri][ci]}.png')
    # ---- image 1: stone column (+ bark, foliage, ore) and the built stone block
    m1 = load(p1)
    c1, r1 = grid(m1, 275, 140, 1070, 675, minlen=50)
    print('img1 grid', c1, r1)
    names1 = ['soil', 'stone', 'ore', 'crystal', 'precious', 'bark', 'foliage']
    keep1 = {'stone', 'ore', 'bark', 'foliage'}
    for ri, yr in enumerate(r1[:5]):
        for ci, xr in enumerate(c1[:7]):
            if names1[ci] in keep1: save(cut_tile(m1, xr, yr, inset=0.12), f'{outdir}/tex/{biomes[ri]}_{names1[ci]}.png')
    bc1, br1 = grid(m1, 1140, 150, 1550, 600, minlen=50, thr_frac=0.6)
    print('img1 build', bc1, br1)
    if bc1 and br1: save(cut_tile(m1, bc1[2], br1[0], inset=0.1), f'{outdir}/tex/build_stone.png')
    # ---- image 2: props, icons, fx
    m2 = load(p2)
    pc, _ = grid(m2, 100, 88, 1740, 300, minlen=40, thr_frac=0.02)
    print('img2 props cols', pc)
    props = ['shrine', 'campfire', 'bladestone', 'hearth', 'lantern', 'banner', 'seed']
    for i, (a, b) in enumerate(pc[:7]):
        glow = props[i] in ('seed',)
        meta['props/' + props[i]] = sprite(m2, (a - 14, 92, b + 14, 300), f'{outdir}/props/{props[i]}.png', glow=glow, lo=12, hi=40)
    bi, _ = grid(m2, 120, 385, 1740, 455, minlen=20, thr_frac=0.02)
    print('img2 blocks', len(bi))
    blocks = ['stone', 'deepstone', 'shadowstone', 'sandstone', 'snow', 'earth', 'wood', 'planks', 'brick', 'ice', 'marble', 'obsidian', 'rootcrystal', 'sunstone', 'emberrock', 'rime', 'lantern', 'brazier']
    for i, (a, b) in enumerate(bi[:18]):
        meta['icons/b_' + blocks[i]] = sprite(m2, (a - 6, 388, b + 6, 452), f'{outdir}/icons/b_{blocks[i]}.png', lo=10, hi=36)
    ui, _ = grid(m2, 140, 535, 1340, 600, minlen=20, thr_frac=0.02)
    print('img2 ui', len(ui))
    uinames = ['vessel', 'vessel_empty', 'glimmer', 'r_djump', 'r_wall', 'r_plunge', 'r_surge', 'r_vessel']
    for i, (a, b) in enumerate(ui[:8]):
        meta['icons/' + uinames[i]] = sprite(m2, (a - 8, 535, b + 8, 602), f'{outdir}/icons/{uinames[i]}.png', lo=10, hi=36, glow=uinames[i] == 'glimmer')
    fxc, _ = grid(m2, 100, 680, 1720, 815, minlen=40, thr_frac=0.02)
    merged = []
    for r in fxc:
        if merged and r[0] - merged[-1][1] < 14: merged[-1] = (merged[-1][0], r[1])
        else: merged.append(r)
    fxc = merged
    print('img2 fx', fxc)
    fxn = ['slash', 'spark', 'wave', 'souls', 'dust', 'thread']
    for i, (a, b) in enumerate(fxc[:6]):
        meta['fx/' + fxn[i]] = sprite(m2, (a - 10, 678, b + 10, 815), f'{outdir}/fx/{fxn[i]}.png', glow=fxn[i] != 'dust', lo=10, hi=40)
    json.dump(meta, open(outdir + '/sprites.json', 'w'), indent=1)

if __name__ == '__main__':
    main(*sys.argv[1:5])

def tree_sprites(p3, outdir, meta):
    """the five flora sprites of the materials sheet: keep pixels brighter than the board (drops the cast
    shadow and dark halo), erode one pixel of fringe, bleed edge colours outward so scaling has no dark rim"""
    from PIL import ImageFilter
    img = load(p3)
    boxes = {'meadow': (1340, 236, 1495, 453), 'glass': (1492, 236, 1634, 456), 'hollow': (1634, 276, 1759, 456),
             'ember': (1405, 516, 1480, 746), 'frost': (1530, 488, 1672, 746)}
    os.makedirs(outdir + '/trees', exist_ok=True)
    for k, (x0, y0, x1, y1) in boxes.items():
        reg = img[y0:y1, x0:x1]
        ring = np.concatenate([reg[:3].reshape(-1, 3), reg[:, :3].reshape(-1, 3), reg[:, -3:].reshape(-1, 3)])
        bg = np.median(ring, axis=0)
        lum = reg.mean(axis=2) - bg.mean()
        d = np.sqrt(((reg - bg) ** 2).sum(axis=2))
        lt = 34 if k == 'hollow' else 6
        a = np.clip((d - 22) / 30, 0, 1) * np.clip((lum - lt) / 14, 0, 1)
        # the cast shadow at the foot: below the trunk base keep only the trunk's columns
        h = a.shape[0]; ref = a[h - 22]
        cols = np.where(ref > 0.5)[0]
        if len(cols):
            keep = np.zeros_like(ref); keep[max(0, cols.min() - 2):cols.max() + 3] = 1
            a[h - 21:] *= keep
        am = Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
        a = np.asarray(am).astype(np.float32) / 255
        col = reg.copy()
        solid = a > 0.6
        for _ in range(4):  # bleed solid colours into the fringe
            sh = [np.roll(col, s, ax) for s in (1, -1) for ax in (0, 1)]
            ms = [np.roll(solid, s, ax) for s in (1, -1) for ax in (0, 1)]
            acc = np.zeros_like(col); n = np.zeros(solid.shape, np.float32)
            for c, m in zip(sh, ms): acc += c * m[..., None]; n += m
            grow = (~solid) & (n > 0)
            col[grow] = acc[grow] / n[grow][:, None]; solid = solid | grow
        ys, xs = np.where(a > 0.05)
        bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        save(col[by0:by1, bx0:bx1], f'{outdir}/trees/{k}.png', a[by0:by1, bx0:bx1])
        meta['trees/' + k] = (int(bx1 - bx0), int(by1 - by0))
