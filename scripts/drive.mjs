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
  // A locked or sleeping display cannot be captured; the run itself does not need the picture.
  await page.screenshot({ path: f, timeout: 8000 }).catch(() => console.log("(no screenshot: display not available)"))
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
  // DIRECTION=template uses the Explainer template; otherwise the phone-to-chip example.
  if (process.env.DIRECTION === 'template') await page.locator('button', { hasText: 'Explainer' }).first().click()
  else await page.fill('textarea', process.env.DIRECTION || 'One prompt, followed from the phone to the chip and back: the cell tower, the cable under the sea, the data center, the rows of servers, one GPU, and the answer coming home word by word. Dark board, pen drawings, one idea at a time.')
  // Quicker test: Sonnet, medium effort, low checks.
  await page.locator('button', { hasText: 'Opus 5.5' }).first().click()
  await page.locator('button', { hasText: 'Sonnet 5.5' }).first().click()
  await page.locator('button', { hasText: 'Intelligence: High' }).first().click()
  await page.locator('button', { hasText: 'Intelligence: Medium' }).first().click()
  await page.locator('select').nth(1).selectOption('Low')
  await page.locator('select').nth(0).selectOption('1080-30')
  // STYLE=<name> ENGINE=Auto|Remotion|HyperFrames CAPTIONS=Off|Clean|Bold pop|Karaoke TRANSITION=None|Fade|...
  const chip = (text) => page.locator('button.chip', { hasText: new RegExp('^' + text + '$') }).first().click()
  if (process.env.STYLE) {
    await page.locator('button', { hasText: /^Show all \d+ styles$/ }).click()
    await page.locator('button', { hasText: process.env.STYLE }).first().click()
  }
  if (process.env.ENGINE) await chip(process.env.ENGINE)
  if (process.env.CAPTIONS) await chip(process.env.CAPTIONS)
  if (process.env.TRANSITION) await chip(process.env.TRANSITION)
  if (process.env.SFX) await chip(process.env.SFX)
  // Wait until the voiceover has been heard (first run downloads whisper.cpp).
  for (let i = 0; i < 90 && (await page.evaluate(() => document.body.innerText.includes('Working…'))); i++) await page.waitForTimeout(10000)
  console.log('heard:', (await page.evaluate(() => document.body.innerText.match(/Heard[^\n]*|Could not hear[^\n]*/)?.[0])) ?? '?')
  await shot('ready-to-make')
  await page.click('text=Make my video')
  const start = Date.now()
  let last = ''
  let pausedOnce = false
  while (Date.now() - start < 90 * 60000) {
    await page.waitForTimeout(process.env.PAUSE ? 4000 : 20000)
    const txt = await page.evaluate(() => document.body.innerText)
    const status = txt.match(/(Coming up with ideas for part \d+|Drawing part \d+|Rendering part \d+|Checking part \d+|Repairing part \d+|Putting the video together|Listening to the voiceover|Planning the video|Something went wrong|Your video is ready|Rendering|Getting the drawing browser[^\n]*)/)?.[0] ?? '?'
    if (status !== last) {
      console.log(Math.round((Date.now() - start) / 1000) + 's', status)
      last = status
      await shot(status.replace(/\W+/g, '-').toLowerCase())
    }
    // PAUSE=1: pause while part 2 is rendering, then resume.
    if (process.env.PAUSE && !pausedOnce && /Rendering part 2/.test(txt)) {
      pausedOnce = true
      await page.locator('button[title="Pause"]').first().click()
      await page.waitForTimeout(3000)
      await shot('paused')
      console.log('paused:', (await page.evaluate(() => document.body.innerText.includes('Paused'))) ? 'yes' : 'NO')
      await page.waitForTimeout(4000)
      await page.locator('button[title="Resume"]').first().click()
      await page.waitForTimeout(1500)
      await shot('resumed')
    }
    if (/Ready\n/.test(txt) && !txt.includes('is working')) break
    if (status === 'Something went wrong') {
      console.log((await page.locator('.italic').first().textContent()) ?? '')
      break
    }
  }
  await shot('done')

  // PUBLISH=1: thumbnails, titles + description, tidy captions, and the finishing pass.
  if (process.env.PUBLISH) await publishSteps()
  await commentStep()
}

async function publishSteps() {
  {
    await page.locator('aside button.tab', { hasText: 'Publish' }).click()
    await shot('publish')
    const waitIdle = async (label) => {
      for (let i = 0; i < 120; i++) {
        await page.waitForTimeout(3000)
        if (!(await page.locator('aside .spinner').count())) break
      }
      await shot(label)
    }
    await page.click('text=Make 3')
    await waitIdle('publish-thumbnails')
    await page.locator('button', { hasText: /Write them|Write again/ }).click()
    await waitIdle('publish-titles')
    await page.locator('button', { hasText: /Tidy with/ }).click()
    await waitIdle('publish-captions')
    await page.locator('button', { hasText: /Put the video together again|Apply to the video/ }).click()
    await waitIdle('publish-finished')
    console.log('publish:', JSON.stringify(await page.evaluate(() => ({ thumbs: document.querySelectorAll('aside img.aspect-video').length, titles: document.body.innerText.includes('Titles · click') }))))
  }
}

async function commentStep() {
  // Comment on part 2, send it, and wait until only that part is drawn again.
  const tiles = page.locator('[title*="·"][class*="absolute top-0 h-full cursor-pointer"]')
  if (!process.env.SKIP_COMMENT && (await tiles.count()) > 1) {
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

// publish = open the most recent video and run the Publish tab steps.
if (mode === 'publish') {
  await page.locator('aside button:has(div.h-7)').first().click()
  await page.waitForSelector('[title="Export"]')
  await publishSteps()
}

// comment = open the most recent video and send one comment on part 2 (uses an existing userdata folder).
if (mode === 'comment') {
  await page.locator('aside button:has(div.h-7)').first().click()
  await page.waitForSelector('[title="Export"]')
  await shot('opened')
  await page.click('[title="Next part (→)"]')
  await page.click('[title="Next part (→)"]')
  await shot('arrows')
  const tiles = page.locator('[title*="·"][class*="absolute top-0 h-full cursor-pointer"]')
  await tiles.nth(1).click()
  await page.fill('textarea', process.env.NOTE || 'Make the main drawing bigger and add a short label to it')
  await shot('comment')
  await page.click('text=Save comment')
  await page.click('text=/Send 1 change/')
  await shot('comment-sent')
  for (let i = 0; i < 240; i++) {
    await page.waitForTimeout(5000)
    const txt = await page.evaluate(() => document.body.innerText)
    if (i === 3) await shot('comment-working')
    if (!txt.includes('is working') && !txt.includes('Working')) break
  }
  await shot('comment-done')
}

await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
