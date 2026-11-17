/**
 * `NODE_ENV=development pnpm preset:previews -- --yes [--only <code>,…] [--backup-to <file>] [--pictures <file>]`
 *
 * The gallery's thumbnails for the ready-made looks (adr/0063 §7, adr/0064
 * Ek 2026-11-17): every preset applied in turn to the theme editor's draft
 * of the local shop, its draft preview opened at 1440×900 in headless
 * Chromium, brought to rest, and the view written as an 800×500 WebP to
 * `packages/sector-packs/packs/<pack>/presets/<code>/preview.webp`.
 *
 * The backend, the storefront and `seed:demo` must be up. A temporary
 * owner does the work and is removed at the end; nobody's account is used.
 * The developer's draft is kept first as a saved look, put back at the end
 * and checked against what was read before (`--backup-to` also writes it to
 * a file); nothing is published. Refused outside development or without `--yes`.
 * `--pictures` writes the file names of the photos each thumbnail shows,
 * for its credits (docs/12).
 */
import { existsSync } from "node:fs"
import { writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { chromium } from "@playwright/test"
import type { Browser, Page } from "@playwright/test"
import { createTemporaryAdmin, removeTemporaryAdmin, signInAdmin } from "../admin.ts"
import type { AdminApi, TemporaryAdmin } from "../admin.ts"
import { print, printError } from "../resolved-style/print.ts"
import { settle } from "../resolved-style/settle.ts"
import { BACKUP_NAME, keepBackup, readBefore, restore } from "./draft.ts"
import type { Before } from "./draft.ts"
import { asShopperSees, picturesInView } from "./frame.ts"

const STOREFRONT_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:8000"
const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..")
const PACKS = join(REPO_ROOT, "packages", "sector-packs", "packs")

const VIEW = { width: 1440, height: 900 }
const OUT = { width: 800, height: 500 }
/** The loader's own limit (`PRESET_LIMITS.previewBytes`). */
const MAX_BYTES = 256 * 1024
const QUALITIES = [0.72, 0.64, 0.56, 0.48, 0.4]

interface Options {
  only: string[] | null
  backupTo: string | null
  pictures: string | null
}

const USAGE =
  "NODE_ENV=development pnpm preset:previews -- --yes [--only <code>,…] [--backup-to <file>] [--pictures <file>]"

function parseArgs(argv: string[]): Options {
  const args = argv.filter((each) => each !== "--")
  if (process.env["NODE_ENV"] !== "development") {
    throw new Error(`runs against a development shop only (NODE_ENV=development)\n${USAGE}`)
  }
  if (!args.includes("--yes")) {
    throw new Error(
      `applies every ready-made look to the local draft (put back at the end): add --yes\n${USAGE}`
    )
  }
  const value = (flag: string) => {
    const at = args.indexOf(flag)
    return at === -1 ? null : (args[at + 1] ?? null)
  }
  const file = (flag: string) => {
    const given = value(flag)
    return given ? resolve(process.env["INIT_CWD"] ?? process.cwd(), given) : null
  }
  const only = value("--only")
  return {
    only: only ? only.split(",").filter(Boolean) : null,
    backupTo: file("--backup-to"),
    pictures: file("--pictures"),
  }
}

interface Preset {
  pack: string
  code: string
}

interface Applied {
  result: { skipped?: unknown[]; dropped?: unknown[] }
}

/** A PNG made smaller in the browser's own encoder: no image library needed. */
async function toWebp(encoder: Page, png: Buffer): Promise<Buffer> {
  const src = `data:image/png;base64,${png.toString("base64")}`
  for (const quality of QUALITIES) {
    const url = await encoder.evaluate(
      async ({ src, width, height, quality }) => {
        const image = new Image()
        image.src = src
        await image.decode()
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext("2d")
        if (!context) {
          return ""
        }
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = "high"
        context.drawImage(image, 0, 0, width, height)
        return canvas.toDataURL("image/webp", quality)
      },
      { src, ...OUT, quality }
    )
    if (!url.startsWith("data:image/webp;base64,")) {
      throw new Error("the browser did not encode WebP")
    }
    const bytes = Buffer.from(url.slice(url.indexOf(",") + 1), "base64")
    if (bytes.length <= MAX_BYTES) {
      return bytes
    }
  }
  throw new Error(`the thumbnail stays over ${String(MAX_BYTES / 1024)} KB`)
}

/**
 * One look: applied, its draft preview drawn and written next to its
 * preset.json. Returns the photos it shows.
 */
async function captureOne(
  api: AdminApi,
  browser: Browser,
  encoder: Page,
  preset: Preset
): Promise<string[]> {
  const dir = join(PACKS, preset.pack, "presets", preset.code)
  if (!existsSync(join(dir, "preset.json"))) {
    throw new Error(`${preset.pack}/${preset.code}: no preset folder in this checkout`)
  }
  const applied = await api.post<Applied>(
    `/admin/storefront-presets/${preset.pack}/${preset.code}/apply`,
    { demo: false }
  )
  const skipped = applied.result.skipped?.length ?? 0
  const dropped = applied.result.dropped?.length ?? 0
  // The link names the draft as just saved, so it is asked for after every apply; never printed
  const { path } = await api.post<{ path: string }>("/admin/storefront-layout/preview", {})
  const context = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 1,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    reducedMotion: "reduce",
  })
  try {
    const page = await context.newPage()
    await settle(page, `${STOREFRONT_URL}${path}`, print)
    await asShopperSees(page)
    const webp = await toWebp(encoder, await page.screenshot({ type: "png" }))
    await writeFile(join(dir, "preview.webp"), webp)
    print(
      `${preset.pack}/${preset.code}: ${String(Math.round(webp.length / 1024))} KB` +
        (skipped || dropped ? ` (skipped ${String(skipped)}, dropped ${String(dropped)})` : "")
    )
    return await picturesInView(page)
  } finally {
    await context.close()
  }
}

async function captureAll(api: AdminApi, options: Options): Promise<void> {
  const { presets } = await api.get<{ presets: Preset[] }>("/admin/storefront-presets")
  const chosen = presets.filter((each) => !options.only || options.only.includes(each.code))
  if (chosen.length === 0) {
    throw new Error("no ready-made look to draw")
  }
  const browser = await chromium.launch()
  const pictures: Record<string, string[]> = {}
  try {
    const encoder = await (await browser.newContext()).newPage()
    for (const preset of chosen) {
      pictures[`${preset.pack}/${preset.code}`] = await captureOne(api, browser, encoder, preset)
    }
  } finally {
    await browser.close()
  }
  if (options.pictures) {
    await writeFile(options.pictures, `${JSON.stringify(pictures, null, 2)}\n`)
  }
}

/** The draft back and checked, whatever happened in between. */
async function putBack(api: AdminApi, before: Before, backup: string | null): Promise<boolean> {
  const result = await restore(api, before, backup)
  if (result === "same") {
    print("draft: back as it was")
    return true
  }
  if (result === "mark") {
    print("draft: back as it was; only its saved-look mark differs (the gallery's badge)")
    return true
  }
  printError(
    `draft: NOT back as it was; the saved look "${BACKUP_NAME}" is kept: apply it in the panel (Görünümler)`
  )
  return false
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  let admin: TemporaryAdmin | null = null
  let api: AdminApi | null = null
  let ok = true
  try {
    admin = createTemporaryAdmin()
    api = await signInAdmin(admin)
    const before = await readBefore(api)
    if (options.backupTo) {
      await writeFile(options.backupTo, `${JSON.stringify(before.layout, null, 2)}\n`)
    }
    const backup = await keepBackup(api)
    try {
      await captureAll(api, options)
    } catch (error) {
      ok = false
      printError(error instanceof Error ? error.message : String(error))
    } finally {
      ok = (await putBack(api, before, backup)) && ok
    }
  } finally {
    await api?.dispose()
    if (admin) {
      removeTemporaryAdmin(admin.email)
    }
  }
  if (!ok) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  printError(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
