// Renders build/icon.svg to the PNG and ICO files the app and installer use: node scripts/make-icon.mjs
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'fs'

const svg = readFileSync('build/icon.svg', 'utf8')
const png = (size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()

writeFileSync('build/icon.png', png(512))
writeFileSync('resources/icon.png', png(256))

// An .ico is a small header plus one PNG per size.
const sizes = [16, 24, 32, 48, 64, 128, 256]
const images = sizes.map(png)
const header = Buffer.alloc(6 + 16 * sizes.length)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = header.length
sizes.forEach((s, i) => {
  const e = 6 + 16 * i
  header.writeUInt8(s >= 256 ? 0 : s, e)
  header.writeUInt8(s >= 256 ? 0 : s, e + 1)
  header.writeUInt16LE(1, e + 4) // colour planes
  header.writeUInt16LE(32, e + 6) // bits per pixel
  header.writeUInt32LE(images[i].length, e + 8)
  header.writeUInt32LE(offset, e + 12)
  offset += images[i].length
})
writeFileSync('build/icon.ico', Buffer.concat([header, ...images]))
console.log('icon.png, icon.ico written')
