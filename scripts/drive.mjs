// Drives the built app for testing: node scripts/drive.mjs <ui|make> <outDir> [voiceover]
// ui   = screenshot every page
// make = drop the voiceover, write a direction, press Make my video, and watch until the video is ready
import { _electron as electron } from 'playwright'
import { mkdirSync } from 'fs'
import { join, resolve } from 'path'

const [mode = 'ui', outDir = 'shots', voice] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const userData = resolve(outDir, 'userdata')

// FAKE=1 swaps Claude for a stand-in that writes simple scenes (tests everything but the AI).
// EXE=path tests a packaged build instead of the dev one.
const app = await electron.launch({ ...(process.env.EXE ? { executablePath: resolve(process.env.EXE), args: [`--user-data-dir=${userData}`] } : { args: ['.', `--user-data-dir=${userData}`] }), cwd: resolve('.'), timeout: 60000, env: { ...process.env, INKFRAME_FAKE_AGENT: process.env.FAKE ?? '' } })
const page = await app.firstWindow()
page.on('console', (m) => m.type() === 'error' && console.log('[page]', m.text()))
await page.setViewportSize({ width: +(process.env.W ?? 1840), height: +(process.env.H ?? 1040) })
await page.waitForSelector('text=New video')
let n = 0
const shot = async (name) => {
  await page.waitForTimeout(400)
  const f = join(outDir, `${String(++n).padStart(2, '0')}-${name}.png`)
  await page.screenshot({ path: f })
  console.log('shot', f)
}

// Save videos in the test folder, not the real one.
await page.evaluate((d) => window.api.settings.set({ saveDir: d }), resolve(outDir, 'videos'))

if (voice) {
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] })
  }, resolve(voice))
}

const nav = (label) => page.locator('aside nav button', { hasText: label }).click()

if (mode === 'ui') {
  await shot('home')
  await page.evaluate(() => document.querySelector('main').scrollTo(0, 820))
  await shot('home-lower')
  await page.evaluate(() => document.querySelector('main').scrollTo(0, 0))
  if (voice) {
    await page.click('text=Choose a file')
    await page.waitForSelector('text=Replace')
    await page.fill('textarea', 'One prompt, followed from the phone to the chip and back: the cell tower, the cable under the sea, the data center, the rows of servers, one GPU, and the answer coming home word by word. Dark board, pen drawings, one idea at a time.')
    await shot('home-voiceover')
    await page.locator('button', { hasText: 'Claude Code' }).first().click()
    await shot('home-provider-menu')
    await page.keyboard.press('Escape')
  }
  await nav('Styles')
  await shot('styles')
  await page.click('text=Learn from a video >> nth=1')
  await shot('styles-learn')
  await nav('Characters')
  await shot('characters')
  await page.locator('main .card').first().click()
  await shot('character-editor')
  await nav('Settings').catch(() => page.click('text=Settings'))
  await shot('settings')
}

if (mode === 'make') {
  await page.click('text=Choose a file')
  await page.waitForSelector('text=Replace')
  await page.fill('textarea', 'One prompt, followed from the phone to the chip and back: the cell tower, the cable under the sea, the data center, the rows of servers, one GPU, and the answer coming home word by word. Dark board, pen drawings, one idea at a time.')
  // Quicker test: Sonnet, medium effort, low checks.
  await page.locator('button', { hasText: 'Opus 5.5' }).first().click()
  await page.locator('button', { hasText: 'Sonnet 5.5' }).first().click()
  await page.locator('button', { hasText: 'Intelligence: High' }).first().click()
  await page.locator('button', { hasText: 'Intelligence: Medium' }).first().click()
  await page.locator('select').nth(1).selectOption('Low')
  await page.locator('select').nth(0).selectOption('1080-30')
  // Wait until the voiceover has been heard (first run downloads whisper.cpp).
  for (let i = 0; i < 90 && (await page.evaluate(() => document.body.innerText.includes('Working…'))); i++) await page.waitForTimeout(10000)
  console.log('heard:', (await page.evaluate(() => document.body.innerText.match(/Heard[^\n]*|Could not hear[^\n]*/)?.[0])) ?? '?')
  await shot('ready-to-make')
  await page.click('text=Make my video')
  const start = Date.now()
  let last = ''
  while (Date.now() - start < 90 * 60000) {
    await page.waitForTimeout(20000)
    const txt = await page.evaluate(() => document.body.innerText)
    const status = txt.match(/(Coming up with ideas for part \d+|Drawing part \d+|Rendering part \d+|Checking part \d+|Repairing part \d+|Putting the video together|Listening to the voiceover|Planning the video|Something went wrong|Your video is ready|Rendering|Getting the drawing browser[^\n]*)/)?.[0] ?? '?'
    if (status !== last) {
      console.log(Math.round((Date.now() - start) / 1000) + 's', status)
      last = status
      await shot(status.replace(/\W+/g, '-').toLowerCase())
    }
    if (/Ready\n/.test(txt) && !txt.includes('is working')) break
    if (status === 'Something went wrong') {
      console.log((await page.locator('.italic').first().textContent()) ?? '')
      break
    }
  }
  await shot('done')

  // Comment on part 2, send it, and wait until only that part is drawn again.
  const tiles = page.locator('[title*="·"][class*="absolute top-0 h-full cursor-pointer"]')
  if ((await tiles.count()) > 1) {
    await tiles.nth(1).click()
    await page.fill('textarea', 'Draw the box bigger and label it')
    await shot('comment')
    await page.click('text=Save comment')
    await page.click('text=/Send 1 change/')
    await shot('comment-sent')
    for (let i = 0; i < 120; i++) {
      await page.waitForTimeout(5000)
      const txt = await page.evaluate(() => document.body.innerText)
      if (!txt.includes('is working')) break
      if (i === 2) await shot('comment-working')
    }
    await shot('comment-done')
  }
}

await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
