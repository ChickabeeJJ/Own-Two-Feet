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
    """the five flora sprites of the materials sheet. The board is removed by flood fill from the crop border
    (only background connected to the outside goes, so dark shading inside a tree stays), the cast shadow and
    glow halo count as background, edges get a soft alpha from colour distance, and edge colours are bled in
    from the inside so there is no dark rim when the sprite is scaled."""
    from collections import deque
    from PIL import ImageFilter
    img = load(p3)
    boxes = {'meadow': (1340, 236, 1495, 456), 'glass': (1492, 236, 1634, 458), 'hollow': (1634, 276, 1759, 458),
             'ember': (1405, 516, 1480, 748), 'frost': (1530, 488, 1672, 748)}
    os.makedirs(outdir + '/trees', exist_ok=True)
    for k, (x0, y0, x1, y1) in boxes.items():
        reg = img[y0:y1, x0:x1]
        h, w, _ = reg.shape
        ring = np.concatenate([reg[:3].reshape(-1, 3), reg[:, :3].reshape(-1, 3), reg[:, -3:].reshape(-1, 3)])
        bg = np.median(ring, axis=0)
        d = np.sqrt(((reg - bg) ** 2).sum(axis=2))
        lum = reg.mean(axis=2) - bg.mean()
        dark_lim = 42 if k == 'hollow' else 10
        bgl = (d < 30) | (lum < dark_lim)
        flood = np.zeros((h, w), bool)
        q = deque()
        for y in range(h):
            for x in (0, w - 1):
                if bgl[y, x] and not flood[y, x]: flood[y, x] = True; q.append((y, x))
        for x in range(w):
            for y in (0, h - 1):
                if bgl[y, x] and not flood[y, x]: flood[y, x] = True; q.append((y, x))
        while q:
            y, x = q.popleft()
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and not flood[ny, nx] and bgl[ny, nx]:
                    flood[ny, nx] = True; q.append((ny, nx))
        # dark specks clinging to the edge belong to the board too
        near = np.asarray(Image.fromarray((flood * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
        flood |= near & (lum < 26)
        a = (~flood).astype(np.float32)
        # the cast shadow at the foot: below the trunk base only the trunk's own columns stay
        ref = a[h - 24]
        cols = np.where(ref > 0.5)[0]
        if len(cols):
            keep = np.zeros(w, np.float32); keep[max(0, cols.min() - 1):cols.max() + 2] = 1
            a[h - 23:] *= keep
            flood[h - 23:] |= keep[None, :] < 0.5
        # soft edge: pixels touching the background get partial alpha from how different they are
        edge = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))).astype(np.float32) / 255
        rim = (a > 0) & (edge < 1)
        a[rim] = np.clip((d[rim] - 18) / 50, 0.25, 1)
        a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.45))).astype(np.float32) / 255
        a[flood & (a < 0.5)] *= 0.4
        col = reg.copy()
        solid = edge >= 1
        for _ in range(3):
            acc = np.zeros_like(col); n = np.zeros(solid.shape, np.float32)
            for sy, sx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                m = np.roll(np.roll(solid, sy, 0), sx, 1); c = np.roll(np.roll(col, sy, 0), sx, 1)
                acc += c * m[..., None]; n += m
            grow = (~solid) & (n > 0)
            col[grow] = acc[grow] / n[grow][:, None]; solid = solid | grow
        ys, xs = np.where(a > 0.05)
        bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        save(col[by0:by1, bx0:bx1], f'{outdir}/trees/{k}.png', a[by0:by1, bx0:bx1])
        meta['trees/' + k] = (int(bx1 - bx0), int(by1 - by0))


# ---------------------------------------------------------------- the painted request sheet (art requests board)
# boxes are in a 1000-wide frame of the sheet and scaled to the real size; each box holds only the art, not the label
REQ_BOXES = {
    'cave_mouth': (424, 96, 584, 184), 'nest': (640, 104, 742, 180), 'satchel': (830, 100, 944, 182),
    'ladder': (30, 262, 112, 344), 'platform': (136, 262, 224, 344), 'torch': (246, 262, 328, 344),
    'door': (352, 262, 434, 344), 'step': (458, 262, 542, 344), 'chest': (566, 262, 650, 344),
    'bench': (674, 262, 758, 344), 'forge': (782, 262, 866, 344), 'loom': (890, 262, 974, 344),
    'draught': (40, 418, 118, 484), 'flare': (160, 418, 240, 484), 'charge': (282, 418, 360, 484),
    'lamp': (404, 418, 480, 484), 'pick_gilt': (526, 418, 602, 484), 'pick_crystal': (646, 418, 722, 484),
    'charm_thread': (766, 418, 846, 484), 'charm_ember': (886, 418, 966, 484),
}
REQ_DISC = {'torch': 30, 'lamp': 58, 'flare': 30, 'charm_thread': 34, 'charm_ember': 34}
REQ_GLOW = set()   # the game lights these itself; a halo cut from the board reads as a dark disc

def request_sprites(p, outdir):
    """cut the painted requests off their dark cards. Board pixels connected to the crop border are flooded
    away; a light source keeps a soft halo (brightness above the board becomes alpha)."""
    from collections import deque
    from PIL import ImageFilter
    img = load(p)
    k = img.shape[1] / 1000
    os.makedirs(outdir + '/req', exist_ok=True)
    meta = json.load(open(outdir + '/sprites.json'))
    for name, box in REQ_BOXES.items():
        x0, y0, x1, y1 = [int(round(v * k)) for v in box]
        reg = img[y0:y1, x0:x1]
        h, w, _ = reg.shape
        ring = np.concatenate([reg[:2].reshape(-1, 3), reg[-2:].reshape(-1, 3), reg[:, :2].reshape(-1, 3), reg[:, -2:].reshape(-1, 3)])
        bg = np.median(ring, axis=0)
        d = np.sqrt(((reg - bg) ** 2).sum(axis=2))
        bgl = d < (16 if name in ('cave_mouth', 'nest') else 22)
        if name in REQ_DISC:   # a dark painted disc behind light sources: board-dark tones count as board
            bgl |= (reg.mean(axis=2) - bg.mean()) < REQ_DISC[name]
        flood = np.zeros((h, w), bool); q = deque()
        for y in range(h):
            for x in (0, w - 1):
                if bgl[y, x]: flood[y, x] = True; q.append((y, x))
        for x in range(w):
            for y in (0, h - 1):
                if bgl[y, x] and not flood[y, x]: flood[y, x] = True; q.append((y, x))
        while q:
            y, x = q.popleft()
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and not flood[ny, nx] and bgl[ny, nx]:
                    flood[ny, nx] = True; q.append((ny, nx))
        a = (~flood).astype(np.float32)
        edge = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))).astype(np.float32) / 255
        rim = (a > 0) & (edge < 1)
        a[rim] = np.clip((d[rim] - 10) / 40, 0.3, 1)
        a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.5))).astype(np.float32) / 255
        col = reg.copy()
        if name in REQ_GLOW:
            # the halo: what is brighter than the board, as additive-looking coverage
            lum = (reg - bg).clip(0).max(axis=2)
            halo = np.clip(lum / 120, 0, 1) * flood
            a = np.maximum(a, halo)
            a3 = np.maximum(a, 1e-3)[..., None]
            col = np.where(flood[..., None], (reg - bg * (1 - a3)) / a3, col)
        # bleed solid colours into the rim so scaling leaves no dark fringe
        solid = edge >= 1
        for _ in range(2):
            acc = np.zeros_like(col); n = np.zeros(solid.shape, np.float32)
            for sy, sx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                m = np.roll(np.roll(solid, sy, 0), sx, 1); c = np.roll(np.roll(col, sy, 0), sx, 1)
                acc += c * m[..., None]; n += m
            grow = (~solid) & (n > 0) & (rim)
            col[grow] = acc[grow] / n[grow][:, None]; solid = solid | grow
        ys, xs = np.where(a > 0.04)
        bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        save(col[by0:by1, bx0:bx1], f'{outdir}/req/{name}.png', a[by0:by1, bx0:bx1])
        meta['req/' + name] = (int(bx1 - bx0), int(by1 - by0))
    json.dump(meta, open(outdir + '/sprites.json', 'w'), indent=1)
    return meta


def clean_bladestone(outdir):
    """the blade-in-stone was cut with its light beam, which mattes to a dark slab: flood the beam's dark
    blue-grey tones away from the border and keep the stone, sword and flowers"""
    from collections import deque
    p = f'{outdir}/props/bladestone.png'
    im = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32)
    rgb, a = im[..., :3], im[..., 3] / 255
    h, w = a.shape
    lum = rgb.mean(axis=2)
    beam = (a < 0.08) | ((lum < 100) & (rgb[..., 2] >= rgb[..., 0] - 6))
    flood = np.zeros((h, w), bool); q = deque()
    for y in range(h):
        for x in (0, w - 1):
            if beam[y, x]: flood[y, x] = True; q.append((y, x))
    for x in range(w):
        for y in (0, h - 1):
            if beam[y, x] and not flood[y, x]: flood[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and not flood[ny, nx] and beam[ny, nx]:
                flood[ny, nx] = True; q.append((ny, nx))
    a2 = a * (~flood)
    from PIL import ImageFilter
    a2 = np.asarray(Image.fromarray((a2 * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.5))).astype(np.float32) / 255
    a2 = np.minimum(a2, a)
    a2[a2 < 0.22] = 0          # faint beam haze
    ys, xs = np.where(a2 > 0.3)
    out = np.dstack([rgb, a2 * 255])[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA').save(p, optimize=True)
    meta = json.load(open(outdir + '/sprites.json'))
    meta['props/bladestone'] = (int(out.shape[1]), int(out.shape[0]))
    json.dump(meta, open(outdir + '/sprites.json', 'w'), indent=1)
