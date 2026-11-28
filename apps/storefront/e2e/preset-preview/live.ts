/**
 * `pnpm preset:previews:live -- --yes --switch <script> --pack <pack> --only <code>,… --restore <code> [--pictures <file>]`
 *
 * The gallery's thumbnails drawn from a shop's live home page, for a local
 * demo shop that has its own way to change looks (a `gorunum.sh`-style
 * script that applies a ready-made look and publishes it, run as
 * `bash <script> <code>`): no admin is signed in and no account made, so
 * the panel's login limit is left alone. Each look is switched to in turn,
 * the home page is asked again until it paints the look's own main colour
 * (`--primary`), and the view at 1440×900 is written as an 800×500 WebP to
 * `packages/sector-packs/packs/<pack>/presets/<code>/preview.webp` (the
 * same frame as `pnpm preset:previews`). The shop is switched to
 * `--restore` at the end, whatever happened. `E2E_BASE_URL`: the storefront
 * (default http://localhost:8000).
 */
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { chromium } from "@playwright/test"
import type { Browser, Page } from "@playwright/test"
import { print, printError } from "../resolved-style/print.ts"
import { settle } from "../resolved-style/settle.ts"
import { toWebp } from "./encode.ts"
import { asShopperSees, picturesInView } from "./frame.ts"

const STOREFRONT_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:8000"
const PACKS = join(import.meta.dirname, "..", "..", "..", "..", "packages", "sector-packs", "packs")
const VIEW = { width: 1440, height: 900 }
const POLL_MS = 5_000
const WAIT_MS = 180_000

const USAGE =
  "pnpm preset:previews:live -- --yes --switch <script> --pack <pack> --only <code>,… --restore <code> [--pictures <file>]"

interface Options {
  switcher: string
  pack: string
  only: string[]
  restore: string
  pictures: string | null
}

function parseArgs(argv: string[]): Options {
  const args = argv.filter((each) => each !== "--")
  const value = (flag: string) => {
    const at = args.indexOf(flag)
    return at === -1 ? null : (args[at + 1] ?? null)
  }
  const here = (path: string) => resolve(process.env["INIT_CWD"] ?? process.cwd(), path)
  const switcher = value("--switch")
  const pack = value("--pack")
  const only = value("--only")?.split(",").filter(Boolean) ?? []
  const restore = value("--restore")
  if (!args.includes("--yes") || !switcher || !pack || only.length === 0 || !restore) {
    throw new Error(`publishes each look on the shop in turn, then --restore: add --yes\n${USAGE}`)
  }
  const pictures = value("--pictures")
  return {
    switcher: here(switcher),
    pack,
    only,
    restore,
    pictures: pictures ? here(pictures) : null,
  }
}

const presetDir = (pack: string, code: string) => join(PACKS, pack, "presets", code)

/** The look's main colour as its theme settings give it: what the live page paints once switched. */
function primaryOf(pack: string, code: string): string {
  const theme = JSON.parse(readFileSync(join(presetDir(pack, code), "theme.json"), "utf8")) as {
    colors?: { primary?: string }
  }
  const primary = theme.colors?.primary
  if (!primary) {
    throw new Error(`${pack}/${code}: its theme names no main colour to wait for`)
  }
  return primary.toLowerCase()
}

function switchTo(script: string, code: string): void {
  execFileSync("bash", [script, code], { stdio: "pipe" })
}

/** Until the home page paints the colour (the storefront keeps a page for a while). */
async function waitForLook(primary: string): Promise<void> {
  const marker = `--primary:${primary}`
  const until = Date.now() + WAIT_MS
  while (Date.now() < until) {
    const html = await fetch(`${STOREFRONT_URL}/`, { cache: "no-store" })
      .then((answer) => answer.text())
      .catch(() => "")
    if (html.toLowerCase().includes(marker)) {
      return
    }
    await new Promise((done) => setTimeout(done, POLL_MS))
  }
  throw new Error(`the home page did not show ${marker} within ${String(WAIT_MS / 1000)} s`)
}

async function captureOne(
  browser: Browser,
  encoder: Page,
  options: Options,
  code: string
): Promise<string[]> {
  const dir = presetDir(options.pack, code)
  if (!existsSync(join(dir, "preset.json"))) {
    throw new Error(`${options.pack}/${code}: no preset folder in this checkout`)
  }
  const primary = primaryOf(options.pack, code)
  switchTo(options.switcher, code)
  await waitForLook(primary)
  const context = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 1,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    reducedMotion: "reduce",
  })
  try {
    const page = await context.newPage()
    await settle(page, `${STOREFRONT_URL}/`, print)
    await asShopperSees(page)
    const webp = await toWebp(encoder, await page.screenshot({ type: "png" }))
    await writeFile(join(dir, "preview.webp"), webp)
    print(`${options.pack}/${code}: ${String(Math.round(webp.length / 1024))} KB`)
    return await picturesInView(page)
  } finally {
    await context.close()
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const pictures: Record<string, string[]> = {}
  const browser = await chromium.launch()
  try {
    const encoder = await (await browser.newContext()).newPage()
    for (const code of options.only) {
      pictures[`${options.pack}/${code}`] = await captureOne(browser, encoder, options, code)
    }
  } finally {
    await browser.close()
    switchTo(options.switcher, options.restore)
    print(`shop: back on ${options.restore}`)
  }
  if (options.pictures) {
    await writeFile(options.pictures, `${JSON.stringify(pictures, null, 2)}\n`)
  }
}

main().catch((error: unknown) => {
  printError(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
