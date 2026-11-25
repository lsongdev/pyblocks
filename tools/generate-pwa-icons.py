"""Generate the app's block mark as PNGs without third-party dependencies."""
from pathlib import Path
import struct
import zlib

OUTPUT = Path(__file__).resolve().parents[1] / 'public' / 'icons'


def rounded_rect(x, y, left, top, right, bottom, radius):
    dx = max(left + radius - x, 0, x - (right - radius))
    dy = max(top + radius - y, 0, y - (bottom - radius))
    return left <= x <= right and top <= y <= bottom and dx * dx + dy * dy <= radius * radius


def icon(size):
    # Three interlocking blocks, kept inside the maskable icon's safe circle.
    pixels = bytearray()
    for row in range(size):
        pixels.append(0)  # PNG scanline filter
        for col in range(size):
            x, y = (col + .5) / size, (row + .5) / size
            color = (85, 68, 140)
            for top, fill in [(.27, (242, 237, 255)), (.435, (181, 161, 239)), (.60, (242, 237, 255))]:
                if rounded_rect(x, y, .28, top, .72, top + .14, .025) or rounded_rect(x, y, .36, top - .035, .46, top + .02, .012):
                    color = fill
                if rounded_rect(x, y, .51, top + .055, .65, top + .08, .008):
                    color = (85, 68, 140)
            pixels.extend(color)

    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))

    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(pixels, 9)) + chunk(b'IEND', b''))


OUTPUT.mkdir(parents=True, exist_ok=True)
for name, size in [('icon-192.png', 192), ('icon-512.png', 512),
                   ('icon-maskable-512.png', 512), ('apple-touch-icon.png', 180)]:
    (OUTPUT / name).write_bytes(icon(size))
