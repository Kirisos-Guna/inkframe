// Cut-outs: people (and their hair and clothes) lifted out of a photo, on a transparent background, like Fireship's
// stickers. Google's MediaPipe selfie segmenter (Apache 2.0) runs on this PC in a hidden window; the model (16 MB) is
// fetched once. Logos and things on a plain white background are cut by colour instead.
import { BrowserWindow } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { pathToFileURL } from 'url'
import { createRequire } from 'module'
import { libDir } from './store'
import { download } from './transcribe'

const req = createRequire(__filename)
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite'

async function model() {
  const file = join(libDir('cutout'), 'selfie_multiclass_256x256.tflite')
  if (!existsSync(file)) await download(MODEL_URL, file)
  return file
}

/** The page that does the work: loads the image, segments it, writes alpha from "not background", returns a PNG. */
const PAGE = (bundle: string) => `<!doctype html><html><body><script type="module">
import { ImageSegmenter } from ${JSON.stringify(bundle)}
// The wasm and the model come in as base64 (a page cannot fetch local files), turned into blob URLs and bytes.
const blobUrl = (b64, type) => URL.createObjectURL(new Blob([Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))], { type }))
window.cut = async (src, mode, loader, binary, modelB64) => {
  const img = new Image()
  img.src = src
  await img.decode()
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const g = c.getContext('2d')
  g.drawImage(img, 0, 0)
  const px = g.getImageData(0, 0, c.width, c.height)
  if (mode === 'white') {
    // Logos on white: white and near-white become transparent, with a soft edge.
    for (let i = 0; i < px.data.length; i += 4) {
      const m = Math.min(px.data[i], px.data[i + 1], px.data[i + 2])
      px.data[i + 3] = m > 245 ? 0 : m > 225 ? Math.round(((245 - m) / 20) * 255) : 255
    }
  } else {
    const files = { wasmLoaderPath: blobUrl(loader, 'text/javascript'), wasmBinaryPath: blobUrl(binary, 'application/wasm') }
    const modelAssetBuffer = Uint8Array.from(atob(modelB64), (ch) => ch.charCodeAt(0))
    const seg = await ImageSegmenter.createFromOptions(files, { baseOptions: { modelAssetBuffer, delegate: 'CPU' }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false })
    const r = seg.segment(img)
    // Mask 0 is the background: alpha is how sure it is NOT background.
    const bg = r.confidenceMasks[0].getAsFloat32Array()
    for (let i = 0, k = 3; i < bg.length; i++, k += 4) px.data[k] = Math.round(Math.min(1, Math.max(0, (1 - bg[i] - 0.15) / 0.7)) * 255)
    seg.close()
  }
  g.putImageData(px, 0, 0)
  return c.toDataURL('image/png')
}
window.ready = true
</script></body></html>`

/** Cuts the subject out of `file` into `out` (PNG). `mode`: 'person' (people) or 'white' (a logo on white). */
export async function cutOut(file: string, out: string, mode: 'person' | 'white' = 'person') {
  // The package only exports its bundle, so find its folder from that.
  const vision = dirname(req.resolve('@mediapipe/tasks-vision'))
  const page = join(libDir('cutout'), 'cut.html')
  writeFileSync(page, PAGE(pathToFileURL(join(vision, 'vision_bundle.mjs')).href))
  const win = new BrowserWindow({ show: false, webPreferences: { webSecurity: false, sandbox: true } })
  try {
    await win.loadURL(pathToFileURL(page).href)
    for (let i = 0; i < 50 && !(await win.webContents.executeJavaScript('!!window.ready')); i++) await new Promise((r) => setTimeout(r, 100))
    const b64 = (p: string) => readFileSync(p).toString('base64')
    const person = mode === 'person'
    const args = person ? [b64(join(vision, 'wasm', 'vision_wasm_internal.js')), b64(join(vision, 'wasm', 'vision_wasm_internal.wasm')), b64(await model())] : ['', '', '']
    const src = `data:image/${/\.png$/i.test(file) ? 'png' : 'jpeg'};base64,${readFileSync(file).toString('base64')}`
    const png = (await win.webContents.executeJavaScript(`window.cut(${[src, mode, ...args].map((a) => JSON.stringify(a)).join(', ')})`)) as string
    writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'))
    return out
  } finally {
    win.destroy()
  }
}
