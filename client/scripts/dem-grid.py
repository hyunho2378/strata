# region-dem.png(RGB, 고도 = (R*256+G)/10 m)을 Uint16 격자 캐시로 뽑는다.
# 실행: python3 client/scripts/dem-grid.py -> client/scripts/data-raw/dem_grid.bin
import os, struct
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, '..', 'public', 'terrain', 'region-dem.png')
out = os.path.join(here, 'data-raw', 'dem_grid.bin')
im = Image.open(src).convert('RGB')
w, h = im.size
px = im.load()
buf = bytearray(w * h * 2)
i = 0
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        v = r * 256 + g
        buf[i] = v & 0xFF
        buf[i + 1] = (v >> 8) & 0xFF
        i += 2
open(out, 'wb').write(buf)
print('cols', w, 'rows', h, 'bytes', len(buf))
