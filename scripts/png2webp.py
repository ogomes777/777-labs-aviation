"""Converte os PNGs de preview (com alfa) em WebP recortado e leve. Uso: python3 scripts/png2webp.py public/media/previews"""
import sys, pathlib
from PIL import Image
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'public/media/previews')
total = 0
for p in sorted(root.rglob('*.png')):
    im = Image.open(p).convert('RGBA')
    bbox = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    if bbox:
        pad = 16
        x0, y0, x1, y1 = bbox
        im = im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))
    out = p.with_suffix('.webp')
    im.save(out, 'WEBP', quality=84, method=6)
    total += out.stat().st_size
    p.unlink()
print(f'webp total: {total/1024:.0f} KiB')
