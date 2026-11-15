/**
 * `pnpm --filter storefront style:capture -- --out <dir> [--base …] [--prefix …]`
 *
 * The resolved style check's capture (adr/0067 §3, step 0b): opens the
 * storefront's pages in headless Chromium at each width, waits for the
 * network and fonts, stops motion, and writes every drawn element's
 * resolved style to `<dir>/<page>@<width>[~<state>].json`, with a manifest
 * and sha256 sums. Only reads (GET): it never answers the cookie banner,
 * adds to a cart or posts a form. `style:diff` compares two such folders.
 */
import { createHash } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { chromium } from "@playwright/test"
import type { Browser, Page } from "@playwright/test"
import { collectStyles } from "./collect.ts"
import { discoverTargets, pageUrl, parseCaptureArgs, redactor } from "./pages.ts"
import type { CaptureOptions, Target } from "./pages.ts"
import { print, printError } from "./print.ts"
import { settle } from "./settle.ts"
import { STATES } from "./states.ts"
import { captureFile } from "./types.ts"
import type { Capture, Manifest, ManifestEntry, SkippedEntry } from "./types.ts"

const options = parseCaptureArgs(process.argv.slice(2), process.env)
const redact = redactor(options.prefix)
const say = (text: string) => {
  print(redact(text))
}
const out = resolve(process.env["INIT_CWD"] ?? process.cwd(), options.out)

/** The self-test's tampering (`--inject-css`, `--add-class`): proves a change shows, a renamed class does not. */
async function tamper(page: Page, opts: CaptureOptions): Promise<void> {
  if (opts.injectCss) {
    await page.addStyleTag({ content: opts.injectCss })
  }
  if (opts.addClass) {
    const [selector, name] = opts.addClass.split("=", 2)
    await page.evaluate(
      ([sel, cls]) => {
        for (const el of Array.from(document.querySelectorAll(sel ?? ""))) {
          el.classList.add(cls ?? "rs-tamper")
        }
      },
      [selector, name]
    )
  }
}

function serialise(capture: Capture): string {
  const head = JSON.stringify({ ...capture, elements: undefined }).slice(0, -1)
  const rows = Object.entries(capture.elements).map(
    ([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`
  )
  return `${head},"elements":{\n${rows.join(",\n")}\n}}\n`
}

async function captureOne(
  browser: Browser,
  target: Target,
  width: number,
  state: string
): Promise<{ entry: ManifestEntry } | { skipped: string }> {
  const started = Date.now()
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    reducedMotion: "reduce",
  })
  try {
    const page = await context.newPage()
    await settle(page, pageUrl(options.base, options.prefix, target.path), say)
    await tamper(page, options)
    if (state !== "load") {
      const why = await STATES.find((each) => each.name === state)?.apply(page)
      if (why) {
        return { skipped: why }
      }
      await page.evaluate(
        () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
      )
    }
    const capture: Capture = {
      page: target.name,
      path: target.path,
      width,
      state,
      elements: await page.evaluate(collectStyles),
    }
    const body = serialise(capture)
    const file = captureFile(target.name, width, state)
    await writeFile(resolve(out, file), body)
    return {
      entry: {
        file,
        page: target.name,
        path: target.path,
        width,
        state,
        elements: Object.keys(capture.elements).length,
        sha256: createHash("sha256").update(body).digest("hex"),
        ms: Date.now() - started,
        bytes: Buffer.byteLength(body),
      },
    }
  } catch (error) {
    if (state === "load") {
      throw error
    }
    return { skipped: `failed: ${(error as Error).message.split("\n")[0] ?? ""}` }
  } finally {
    await context.close()
  }
}

/** Clears the captures an earlier run left in the folder (only the files its manifest lists). */
async function clearOld(): Promise<void> {
  const old = await readFile(resolve(out, "manifest.json"), "utf8").catch(() => null)
  if (old === null) {
    return
  }
  const manifest = JSON.parse(old) as Manifest
  for (const each of manifest.captures) {
    await rm(resolve(out, each.file), { force: true })
  }
}

async function main(): Promise<void> {
  await mkdir(out, { recursive: true })
  await clearOld()
  const browser = await chromium.launch()
  const captures: ManifestEntry[] = []
  const skipped: SkippedEntry[] = []
  const wall = Date.now()
  try {
    const first = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await settle(first, pageUrl(options.base, options.prefix, "/"), say)
    const targets = await discoverTargets(first, options)
    await first.close()
    const tasks = targets.flatMap((target) =>
      options.widths.flatMap((width) =>
        [
          "load",
          ...STATES.filter(
            (each) =>
              each.pages.includes(target.name) &&
              (!each.widths || each.widths.includes(width)) &&
              (!options.states || options.states.includes(each.name))
          ).map((each) => each.name),
        ].map((state) => ({ target, width, state }))
      )
    )
    // A few pages at once, each in its own context; the manifest keeps the tasks' order
    const results: (ManifestEntry | SkippedEntry | undefined)[] = []
    let next = 0
    const worker = async () => {
      for (let i = next++; i < tasks.length; i = next++) {
        const task = tasks[i]
        if (!task) {
          return
        }
        const { target, width, state } = task
        const result = await captureOne(browser, target, width, state)
        if ("entry" in result) {
          results[i] = result.entry
          const { file, elements, ms, bytes } = result.entry
          print(`${file}  ${elements} elements  ${ms} ms  ${Math.round(bytes / 1024)} KB`)
        } else {
          results[i] = { page: target.name, width, state, reason: redact(result.skipped) }
          print(`${captureFile(target.name, width, state)}  skipped: ${redact(result.skipped)}`)
        }
      }
    }
    await Promise.all(Array.from({ length: options.jobs }, worker))
    for (const each of results) {
      if (each && "file" in each) {
        captures.push(each)
      } else if (each) {
        skipped.push(each)
      }
    }
  } finally {
    await browser.close()
  }
  const manifest: Manifest = {
    tool: "resolved-style",
    version: 1,
    origin: new URL(options.base).origin,
    prefixed: options.prefix !== "",
    widths: options.widths,
    captures,
    skipped,
  }
  await writeFile(resolve(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(
    resolve(out, "SHA256SUMS"),
    captures.map((each) => `${each.sha256}  ${each.file}\n`).join("")
  )
  const ms = Date.now() - wall
  const bytes = captures.reduce((sum, each) => sum + each.bytes, 0)
  print(
    `\n${captures.length} captures, ${skipped.length} skipped, ${(ms / 1000).toFixed(1)} s, ${Math.round(bytes / 1024)} KB → ${options.out}`
  )
}

main().catch((error: unknown) => {
  printError(redact(error instanceof Error ? error.message : String(error)))
  process.exit(2)
})
