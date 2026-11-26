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
    'nest': (640, 104, 742, 180), 'satchel': (830, 100, 944, 182),
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


def clean_banner(outdir):
    """the gate banner was cut with the dark ground shadow under its tassels: drop the shadow rows and the
    grey pixels around the tassel tips, keep the cloth and the gold"""
    p = f'{outdir}/props/banner.png'
    im = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32)
    rgb, a = im[..., :3], im[..., 3]
    lum = rgb.mean(axis=2)
    rows = [y for y in range(im.shape[0]) if ((a[y] > 100) & (lum[y] > 90)).any()]
    im = im[:max(rows) + 2]
    rgb = im[..., :3]; lum = rgb.mean(axis=2); sat = rgb.max(axis=2) - rgb.min(axis=2)
    h = im.shape[0]; low = np.zeros(lum.shape, bool); low[int(h * 0.78):] = True
    im[..., 3][low & (lum < 95) & (sat < 40)] = 0
    rows = np.where(im[..., 3].max(axis=1) > 20)[0]; im = im[:rows.max() + 1]
    Image.fromarray(im.astype(np.uint8), 'RGBA').save(p, optimize=True)


# the town sheet (1484 x 1060): boxes in sheet pixels, generous, stopping above each label
TOWN_BOXES = {
    # buildings
    'town/house': (70, 165, 272, 346), 'town/smithy': (284, 165, 500, 346), 'town/store': (512, 165, 726, 346),
    'town/inn': (728, 112, 1012, 346), 'town/tailor': (1008, 165, 1200, 346), 'town/alchemist': (1216, 165, 1418, 346),
    # props
    'town/waystone': (84, 448, 178, 574), 'town/well': (214, 452, 330, 574), 'town/board': (366, 468, 476, 574),
    'town/stall': (512, 466, 648, 574), 'town/lamp': (690, 450, 780, 574), 'town/gate': (828, 456, 916, 574),
    'town/yard': (968, 466, 1062, 574),
    # shop signs
    'town/sign_store': (1108, 484, 1198, 566), 'town/sign_smithy': (1198, 484, 1286, 566),
    'town/sign_tailor': (1286, 484, 1374, 566), 'town/sign_alchemist': (1372, 484, 1460, 566),
    # townsfolk
    'town/folk_merchant': (806, 680, 920, 812), 'town/folk_smith': (930, 690, 1026, 812), 'town/folk_tailor': (1040, 676, 1136, 812),
    'town/folk_alchemist': (1146, 676, 1240, 812), 'town/folk_innkeeper': (1252, 680, 1354, 812), 'town/folk_child': (1370, 700, 1442, 812),
    # shop UI icons
    'ui/shop_buy': (46, 922, 114, 994), 'ui/shop_temper': (114, 922, 182, 994), 'ui/shop_tailor': (182, 922, 250, 994),
    'ui/shop_brew': (250, 922, 318, 994), 'ui/shop_rest': (318, 922, 386, 994), 'ui/shop_coin': (384, 922, 452, 994),
    # UI elements
    'ui/slot': (498, 912, 572, 990), 'ui/slot_hover': (571, 912, 645, 990), 'ui/slot_sel': (645, 912, 719, 990),
    'ui/ring': (764, 868, 896, 992), 'ui/panel': (930, 906, 1154, 1000), 'ui/touch': (1190, 924, 1243, 990),
}
# seamless 64 x 64 tiles: cut the inner square of each painted swatch
TOWN_TILES = {'roof': (64, 694, 168, 798), 'cobble': (206, 694, 306, 798), 'timber': (342, 694, 446, 798), 'plaster': (480, 694, 578, 798), 'window': (614, 694, 716, 798)}


TOWN_DISC = {'town/lamp': 24, 'town/waystone': 56}
TOWN_HOLLOW = {'ui/ring', 'ui/touch'}
TOWN_CLEAR = {'town/inn': [(728, 100, 800, 150)]}   # header text that falls inside a box (sheet coords)   # rings: the dark inside becomes see-through   # dark painted glow discs count as board


def matte(reg, thr=22, disc=None):
    """flood the board away from the crop border; soft rim; colours bled into the rim"""
    from collections import deque
    from PIL import ImageFilter
    h, w, _ = reg.shape
    ring = np.concatenate([reg[:2].reshape(-1, 3), reg[-2:].reshape(-1, 3), reg[:, :2].reshape(-1, 3), reg[:, -2:].reshape(-1, 3)])
    bg = np.median(ring, axis=0)
    d = np.sqrt(((reg - bg) ** 2).sum(axis=2))
    bgl = d < thr
    if disc: bgl |= (reg.mean(axis=2) - bg.mean()) < disc
    flood = np.zeros((h, w), bool); q = deque()
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
    a = (~flood).astype(np.float32)
    edge = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))).astype(np.float32) / 255
    rim = (a > 0) & (edge < 1)
    a[rim] = np.clip((d[rim] - 10) / 40, 0.3, 1)
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.5))).astype(np.float32) / 255
    col = reg.copy(); solid = edge >= 1
    for _ in range(2):
        acc = np.zeros_like(col); n = np.zeros(solid.shape, np.float32)
        for sy, sx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            m = np.roll(np.roll(solid, sy, 0), sx, 1); c = np.roll(np.roll(col, sy, 0), sx, 1)
            acc += c * m[..., None]; n += m
        grow = (~solid) & (n > 0) & rim
        col[grow] = acc[grow] / n[grow][:, None]; solid = solid | grow
    return col, a


def keep_main(a, pad=6):
    from collections import deque
    m = a > 0.04; h, w = m.shape; lab = np.zeros((h, w), np.int32); boxes = []
    for sy, sx in zip(*np.where(m)):
        if lab[sy, sx]: continue
        n = len(boxes) + 1; lab[sy, sx] = n; q = deque([(sy, sx)]); b = [sx, sy, sx, sy, 0]
        while q:
            y, x = q.popleft(); b[0] = min(b[0], x); b[1] = min(b[1], y); b[2] = max(b[2], x); b[3] = max(b[3], y); b[4] += 1
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not lab[ny, nx]: lab[ny, nx] = n; q.append((ny, nx))
        boxes.append(b)
    big = max(boxes, key=lambda b: b[4])
    keep = np.zeros((h, w), bool)
    for i, b in enumerate(boxes):
        if b[2] >= big[0] - pad and b[0] <= big[2] + pad and b[3] >= big[1] - pad and b[1] <= big[3] + pad: keep |= lab == i + 1
    return a * keep


def town_sprites(p, outdir, scale=2):
    """cut the painted town sheet: buildings, props, signs, townsfolk, shop icons and UI pieces as sprites
    (upscaled 2x with a smooth filter so they hold up at game size), and the five tiles as seamless 64 x 64"""
    img = load(p)
    # the section header rules run behind the inn's roof and the crafting ring: paint their grey-brown
    # pixels back to board colour (the red roof and the gold ring are kept)
    bg = img[150, 60].copy()
    for y in (133, 134, 135, 136, 895, 896, 897, 898):
        row = img[y]; r, g_, b = row[:, 0], row[:, 1], row[:, 2]
        line = (np.abs(r - g_) < 35) & (np.abs(g_ - b) < 30)
        row[line] = bg
    meta = json.load(open(outdir + '/sprites.json'))
    for name, (x0, y0, x1, y1) in TOWN_BOXES.items():
        os.makedirs(os.path.dirname(f'{outdir}/{name}.png'), exist_ok=True)
        col, a = matte(img[y0:y1, x0:x1], disc=TOWN_DISC.get(name))
        if name in TOWN_HOLLOW: a[col.mean(axis=2) < 45] = 0
        for cx0, cy0, cx1, cy1 in TOWN_CLEAR.get(name, []): a[max(0, cy0 - y0):max(0, cy1 - y0), max(0, cx0 - x0):max(0, cx1 - x0)] = 0
        # keep the largest connected blob and whatever touches its box (drops stray header text)
        a = keep_main(a)
        ys, xs = np.where(a > 0.04)
        if not len(xs): print('empty', name); continue
        bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        rgba = np.dstack([col[by0:by1, bx0:bx1], a[by0:by1, bx0:bx1] * 255]).clip(0, 255).astype(np.uint8)
        im = Image.fromarray(rgba, 'RGBA')
        im = im.resize((im.width * scale, im.height * scale), Image.LANCZOS)
        im.save(f'{outdir}/{name}.png', optimize=True)
        meta[name] = (im.width, im.height)
    os.makedirs(outdir + '/tex', exist_ok=True)
    for name, (x0, y0, x1, y1) in TOWN_TILES.items():
        w, h = x1 - x0, y1 - y0; ix, iy = int(w * 0.12), int(h * 0.12)
        sw = Image.fromarray(img[y0 + iy:y1 - iy, x0 + ix:x1 - ix].clip(0, 255).astype(np.uint8), 'RGB').resize((64, 64), Image.LANCZOS)
        sw.save(f'{outdir}/tex/town_{name}.png', optimize=True)
    json.dump(meta, open(outdir + '/sprites.json', 'w'), indent=1)


# ---------------------------------------------------------------- Art Requests II (painted by the user)
# art/source/requests2_painted.jpg, 1536 x 1024: five Warden cards, four vista strips, five weapons.
RQ2_CARDS = [718, 878, 1039, 1200, 1361]          # left edge of each Warden card (148 wide, y 143..372)
RQ2_STRIPS = {'sky': (40, 152, 486, 198), 'far': (40, 218, 486, 264), 'cath': (40, 284, 486, 331), 'near': (40, 350, 486, 396)}
RQ2_WEAPONS = {'w_blade': ((85, 708, 160, 798), 0.24), 'w_spear': ((220, 704, 296, 798), 0.3), 'w_hammer': ((358, 700, 446, 798), 0.12),
               'w_daggers': ((513, 712, 556, 798), 0.3), 'w_sling': ((658, 716, 762, 798), None)}
# the glass widow shares her tones with the shards behind her, so her outline is traced by hand (card px)
RQ2_WIDOW = [(8, 97), (20, 86), (35, 77), (52, 70), (70, 66), (88, 69), (100, 74), (109, 82), (103, 88), (101, 100), (100, 112), (96, 128),
             (93, 142), (96, 155), (100, 170), (104, 188), (110, 205), (114, 221), (48, 221), (52, 200), (56, 180), (60, 165), (64, 152),
             (60, 140), (56, 128), (50, 112), (40, 104), (25, 99), (12, 98)]


def _morph(m, op, k):
    from PIL import ImageFilter
    f = ImageFilter.MinFilter(k) if op == 'min' else ImageFilter.MaxFilter(k)
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(f)) > 127


def _fill_holes(m):
    from collections import deque
    h, w = m.shape; seen = np.zeros_like(m); q = deque()
    for y in range(h):
        for x in (0, w - 1):
            if not m[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    for x in range(w):
        for y in (0, h - 1):
            if not m[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and not m[ny, nx] and not seen[ny, nx]: seen[ny, nx] = True; q.append((ny, nx))
    return m | ~seen


def _keep_big(m, frac):
    from collections import deque
    h, w = m.shape; lab = np.zeros((h, w), np.int32); sizes = []
    for sy, sx in zip(*np.where(m)):
        if lab[sy, sx]: continue
        n = len(sizes) + 1; lab[sy, sx] = n; q = deque([(sy, sx)]); c = 0
        while q:
            y, x = q.popleft(); c += 1
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not lab[ny, nx]: lab[ny, nx] = n; q.append((ny, nx))
        sizes.append(c)
    if not sizes: return m
    big = max(sizes)
    return np.isin(lab, [i + 1 for i, c in enumerate(sizes) if c >= big * frac])


def _fit_bg(reg, mask):
    """a smooth background (quadratic in x, cubic in y) fitted to the pixels believed to be background"""
    h, w, _ = reg.shape; yy, xx = np.mgrid[0:h, 0:w]; X = xx / w; Y = yy / h
    F = np.stack([np.ones_like(X), X, Y, X * X, Y * Y, X * Y, Y ** 3], -1)
    out = np.zeros_like(reg)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(F[mask], reg[..., c][mask], rcond=None); out[..., c] = F @ coef
    return out


def warden_figure(img, i):
    """one Warden lifted off its card: background fitted and removed, thin ornaments (arches, rays, shard
    edges) opened away, the figure's holes filled, a soft edge, and the bottom faded where the card cut it"""
    from PIL import ImageFilter, ImageDraw
    x = RQ2_CARDS[i]; reg = img[147:368, x + 4:x + 144]; h, w, _ = reg.shape
    init = np.zeros((h, w), bool); init[:int(h * 0.18)] = True; init[:, :5] = True; init[:, -5:] = True
    bg = _fit_bg(reg, init)
    for _ in range(2):
        fg = np.sqrt(((reg - bg) ** 2).sum(-1)) > 30
        bg = _fit_bg(reg, ~_morph(fg.astype(np.float32), 'max', 5))
    d = np.sqrt(((reg - bg) ** 2).sum(-1)); lum = reg.mean(-1) - bg.mean(-1)
    m = d > 32
    if i == 3: m = m | ((reg[..., 0] - reg[..., 2] > 45) & (lum > 14))    # the pyre knight's flames
    k = 7 if i == 2 else 5
    m = _morph(_morph(m.astype(np.float32), 'min', k).astype(np.float32), 'max', k)
    m = _keep_big(m, 0.12 if i == 3 else 0.5)
    if i == 1:
        pm = Image.new('L', (w, h), 0); ImageDraw.Draw(pm).polygon(RQ2_WIDOW, fill=255); m = np.asarray(pm) > 127
    m = _fill_holes(m)
    m = _morph(m.astype(np.float32), 'max', 3)
    a = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.9))).astype(np.float32) / 255
    a = a * np.clip((h - 1 - np.arange(h)) / (h * 0.22), 0, 1)[:, None]
    return reg, a


def _strip(img, box, opaque):
    """a vista strip; above its silhouettes made transparent by flooding from the top edge"""
    from collections import deque
    from PIL import ImageFilter
    x0, y0, x1, y1 = box; reg = img[y0:y1, x0:x1].copy(); h, w, _ = reg.shape
    a = np.ones((h, w), np.float32)
    if not opaque:
        top = np.median(reg[:3], axis=0)                        # the sky colour above each column
        sky = np.sqrt(((reg - top[None]) ** 2).sum(-1)) < 24
        seen = np.zeros((h, w), bool); q = deque()
        for x in range(w):
            if sky[0, x]: seen[0, x] = True; q.append((0, x))
        while q:
            y, x = q.popleft()
            for ny, nx in ((y + 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and sky[ny, nx] and not seen[ny, nx]: seen[ny, nx] = True; q.append((ny, nx))
        a[seen] = 0
        a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32) / 255
    return reg, a


def upscale_clean(im, size):
    """a cleaner enlargement for flat painted shapes: median-filter the JPEG noise away, enlarge in two
    smooth steps, settle the flat colours with a light median, then sharpen the edges back up"""
    from PIL import ImageFilter
    rgb, al = im.convert('RGB'), im.getchannel('A')
    rgb = rgb.filter(ImageFilter.MedianFilter(3))
    mid = (size[0] // 2 + im.width, size[1] // 2 + im.height)
    rgb = rgb.resize(mid, Image.BICUBIC).resize((size[0] * 2, size[1] * 2), Image.LANCZOS)
    rgb = rgb.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.UnsharpMask(radius=3, percent=90, threshold=2))
    rgb = rgb.resize(size, Image.LANCZOS)
    al = al.resize(size, Image.BICUBIC).filter(ImageFilter.GaussianBlur(0.6))
    out = rgb.convert('RGBA'); out.putalpha(al)
    return out


def rq2_sprites(p, outdir):
    from PIL import ImageFilter
    img = load(p)
    meta = json.load(open(outdir + '/sprites.json'))
    os.makedirs(outdir + '/cine', exist_ok=True)
    # the five Wardens, figure only, 4x up with a smooth filter
    for i in range(5):
        reg, a = warden_figure(img, i)
        im = Image.fromarray(np.dstack([reg, a * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
        im = im.resize((im.width * 4, im.height * 4), Image.LANCZOS)
        im.save(f'{outdir}/cine/w{i}.png', optimize=True); meta[f'cine/w{i}'] = (im.width, im.height)
    # the vista: each strip widened to a 1600 x 900 plate at its own band, its ground carried down to the bottom
    PW, PH = 1600, 900
    band = {'sky': 300, 'far': 420, 'cath': 500, 'near': PH}
    for name, box in RQ2_STRIPS.items():
        reg, a = _strip(img, box, name == 'sky')
        sh = int(round(PW / reg.shape[1] * reg.shape[0]))
        strip = upscale_clean(Image.fromarray(np.dstack([reg, a * 255]).clip(0, 255).astype(np.uint8), 'RGBA'), (PW, sh))
        plate = Image.new('RGBA', (PW, PH), (0, 0, 0, 0))
        top = band[name] - (sh if name == 'near' else 0)
        sa = np.asarray(strip).astype(np.float32)
        if name == 'sky':
            # above: the strip's top colour deepening toward the zenith; below: its bottom colour
            t = sa[0, :, :3].mean(0); b = sa[-1, :, :3].mean(0); arr = np.zeros((PH, PW, 4), np.float32); arr[..., 3] = 255
            for y in range(PH):
                if y < top: k = y / max(1, top); arr[y, :, :3] = t * (0.55 + 0.45 * k)
                else: arr[y, :, :3] = b
            plate = Image.fromarray(arr.clip(0, 255).astype(np.uint8), 'RGBA')
            # the strip's foot fades into the plain sky below it (no seam)
            sa[..., 3] *= np.clip((sh - 1 - np.arange(sh)) / (sh * 0.3), 0, 1)[:, None]
            strip = Image.fromarray(sa.clip(0, 255).astype(np.uint8), 'RGBA')
        else:
            # carry the ground down as a smooth wash of the strip's lowest colours (no streaks)
            row = sa[-6:].mean(0); k = 121; pad = np.pad(row, ((k // 2, k // 2), (0, 0)), mode='edge')
            cs = np.cumsum(pad, 0); row = (cs[k:] - cs[:-k]) / k; row = np.concatenate([row, row[-1:]], 0)[:PW]; row[:, 3] = 255
            below = np.repeat(row[None], PH - (top + sh), axis=0) if top + sh < PH and name == 'far' else None
            if name == 'far':    # the haze above the peaks fades out, so the strip has no top edge
                sa[..., 3] *= np.clip(np.arange(sh) / (sh * 0.32), 0, 1)[:, None] ** 1.3
                strip = Image.fromarray(sa.clip(0, 255).astype(np.uint8), 'RGBA')
            if name == 'near':   # the pale mist between the silhouettes fades upward (no hard top edge)
                ramp = np.clip(np.arange(sh) / (sh * 0.8), 0, 1)[:, None] ** 1.5
                light = sa[..., :3].mean(-1) > 80
                sa[..., 3] = np.where(light, sa[..., 3] * ramp, sa[..., 3]); strip = Image.fromarray(sa.clip(0, 255).astype(np.uint8), 'RGBA')
            if name == 'cath':
                # the castle is a pale flat silhouette: rebuild its outline as a crisp threshold of its
                # brightness (antialiased), and settle its colours into a few clean steps
                L = sa[..., :3].mean(-1)
                Lb = np.asarray(Image.fromarray(L.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.4))).astype(np.float32)
                crisp = np.clip((Lb - 128) / 14, 0, 1)
                sa[..., 3] = crisp * 255     # only the castle itself; the mountains behind carry the ground
                inside = crisp > 0.5
                base = np.median(sa[..., :3][inside], axis=0) if inside.any() else np.array([215, 205, 200], np.float32)
                ys = np.linspace(0, 1, sa.shape[0])[:, None, None]
                flat = base[None, None, :] * (1.06 - 0.16 * ys)          # a touch lighter at the top, misty at the foot
                sa[..., :3] = np.where(crisp[..., None] > 0.02, flat, sa[..., :3])
                strip = Image.fromarray(sa.clip(0, 255).astype(np.uint8), 'RGBA')
            if name == 'cath':   # the castle's foot fades into the misty ground of the layer behind
                fa = np.clip((sh - 1 - np.arange(sh)) / (sh * 0.35), 0, 1)
                sa[..., 3] *= fa[:, None]; strip = Image.fromarray(sa.clip(0, 255).astype(np.uint8), 'RGBA')
            if below is not None: plate.alpha_composite(Image.fromarray(below.clip(0, 255).astype(np.uint8), 'RGBA'), (0, top + sh))
        plate.alpha_composite(strip, (0, top))
        plate.save(f'{outdir}/cine/{name}.png', optimize=True); meta[f'cine/{name}'] = (PW, PH)
    # weapons: lifted off the panel, turned to lie flat pointing right (grip at the left)
    wmeta = {}
    os.makedirs(outdir + '/weapons', exist_ok=True)
    for wid, (box, grip) in RQ2_WEAPONS.items():
        x0, y0, x1, y1 = box
        col, a = matte(img[y0:y1, x0:x1], thr=20)
        a = keep_main(a)
        im = Image.fromarray(np.dstack([col, a * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
        if grip is not None:
            ys, xs = np.where(a > 0.3); pts = np.stack([xs, ys], 1).astype(np.float32); pts -= pts.mean(0)
            v = np.linalg.eigh(pts.T @ pts)[1][:, -1]
            if v[1] > 0: v = -v                                  # the axis that points up and to the right
            ang = np.degrees(np.arctan2(-v[1], v[0]))            # its angle above the horizontal
            im = im.rotate(-ang, resample=Image.BICUBIC, expand=True)
        im = im.crop(im.getbbox()); im = im.resize((im.width * 3, im.height * 3), Image.LANCZOS)
        im.save(f'{outdir}/weapons/{wid}.png', optimize=True); meta[f'weapons/{wid}'] = (im.width, im.height)
        if grip is not None: wmeta[wid] = grip
    meta['weapons/_grip'] = wmeta
    json.dump(meta, open(outdir + '/sprites.json', 'w'), indent=1)
