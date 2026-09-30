/**
 * The house mark, rasterised.
 *
 * The logo is four round-capped strokes, which is simple enough to draw exactly
 * without a rendering dependency: every stroke is a capsule, so a pixel is ink
 * when its distance to the nearest segment is within half the stroke width. The
 * shape is sampled 4x4 per pixel and averaged, which gives cleaner edges at
 * favicon sizes than a general SVG rasteriser usually manages.
 *
 * Node's own zlib writes the PNG, so this adds nothing to the dependency tree.
 *
 *   npm run icons
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/* The mark, in the 420-unit space the source SVG uses. Centred vertically:
   the drawn shape spans y 135–285, so its middle sits on the icon's middle. */
const STROKE = 26
const SEGMENTS = [
  [140, 135, 280, 135], // the bar across the top
  [210, 135, 210, 197], // the stem
  [140, 285, 210, 197], // left leg
  [210, 197, 280, 285], // right leg
  [174, 241, 246, 241], // the crossbar
]

const OBSIDIAN = [0x0a, 0x0a, 0x0b]
const CHAMPAGNE = [0xd8, 0xc2, 0x9a]

/** Distance from a point to a line segment. */
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}

/** Inside a rounded rectangle, in the same 420-unit space. */
function insideRoundRect(px, py, size, radius) {
  const qx = Math.abs(px - size / 2) - (size / 2 - radius)
  const qy = Math.abs(py - size / 2) - (size / 2 - radius)
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  return outside - radius <= 0
}

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * @param size      pixel size of the square icon
 * @param scale     how much of the canvas the mark occupies (maskable needs padding)
 * @param radius    corner radius in 420-space; 210 gives a circle, 0 a square
 * @param bg        null for a transparent ground
 */
function render(size, { scale = 1, radius = 92, bg = OBSIDIAN, fg = CHAMPAGNE } = {}) {
  const SS = 4 // samples per axis
  const rgba = Buffer.alloc(size * size * 4)
  const unit = 420 / size
  const half = STROKE / 2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inkHits = 0
      let bgHits = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) * unit
          const py = (y + (sy + 0.5) / SS) * unit
          if (bg && insideRoundRect(px, py, 420, radius)) bgHits++
          // Shrink the mark toward the centre for maskable padding.
          const mx = 210 + (px - 210) / scale
          const my = 210 + (py - 210) / scale
          for (const [x1, y1, x2, y2] of SEGMENTS) {
            if (distToSegment(mx, my, x1, y1, x2, y2) <= half) {
              inkHits++
              break
            }
          }
        }
      }
      const total = SS * SS
      const ink = inkHits / total
      const ground = bgHits / total
      const i = (y * size + x) * 4
      // Ink over ground, ground over nothing.
      const alpha = Math.max(ink, bg ? ground : 0)
      if (alpha === 0) continue
      const base = bg ? bg : [0, 0, 0]
      for (let c = 0; c < 3; c++) {
        const under = bg ? base[c] : fg[c]
        rgba[i + c] = Math.round(under * (1 - ink) + fg[c] * ink)
      }
      rgba[i + 3] = Math.round(alpha * 255)
    }
  }
  return encodePng(size, size, rgba)
}

/* Drawn at its native size the mark fills only ~40% of the tile, which reads as
   a small glyph adrift in a large square. `scale` above 1 grows it toward the
   edges; these values put it at roughly half the tile, and a little over half
   inside a maskable icon's safe circle. */
const targets = [
  ['public/icon-192.png', 192, { scale: 1.3 }],
  ['public/icon-512.png', 512, { scale: 1.3 }],
  // Maskable icons are cropped to a circle by some launchers: the mark stays
  // inside the safe zone while the ground runs to the edges.
  ['public/icon-maskable-512.png', 512, { scale: 1.5, radius: 210 }],
  // iOS applies its own mask and never wants transparency.
  ['public/apple-touch-icon.png', 180, { scale: 1.3, radius: 0 }],
]

for (const [rel, size, opts] of targets) {
  const png = render(size, opts)
  writeFileSync(path.join(ROOT, rel), png)
  console.log(`  ${rel.padEnd(34)} ${size}×${size}  ${(png.length / 1024).toFixed(1)} kB`)
}
console.log('Brand icons written.')
