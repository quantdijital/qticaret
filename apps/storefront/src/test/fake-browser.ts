import { vi } from "vitest"

/**
 * Just enough of a browser for the conversion tags (`lib/analytics`):
 * scripts appended, cookies written, the browser's storage, and a page
 * that has loaded with the browser idle at once (the loaders wait for
 * both). `loading` keeps the page loading until `load()` is called.
 */
export function fakeBrowser(href = "https://shop.test/urun/gomlek", { loading = false } = {}) {
  const scripts: { src: string; nonce: string; async: boolean }[] = []
  const written: string[] = []
  const storage = new Map<string, string>()
  const onLoad: (() => void)[] = []
  const url = new URL(href)
  const win: Record<string, unknown> = {
    location: { href, hostname: url.hostname, origin: url.origin },
    localStorage: {
      get length() {
        return storage.size
      },
      key: (index: number) => [...storage.keys()][index] ?? null,
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
    },
    requestIdleCallback: (run: () => void) => {
      run()
    },
    addEventListener: (type: string, run: () => void) => {
      if (type === "load") {
        onLoad.push(run)
      }
    },
  }
  const doc = {
    referrer: "",
    readyState: loading ? "loading" : "complete",
    head: { appendChild: (script: (typeof scripts)[number]) => scripts.push(script) },
    createElement: () => ({ src: "", nonce: "", async: false }),
    get cookie() {
      return "_ga=GA1.1.1.2; _ga_ABC=x; other=1; _fbp=fb.1.1700000000000.1"
    },
    set cookie(value: string) {
      written.push(value)
    },
  }
  vi.stubGlobal("window", win)
  vi.stubGlobal("document", doc)
  const load = () => {
    doc.readyState = "complete"
    for (const run of onLoad.splice(0)) {
      run()
    }
  }
  return { scripts, written, win, doc, storage, load }
}

/** The calls pushed to GA4's data layer, as plain arrays. */
export const layer = (win: Record<string, unknown>) =>
  ((win["dataLayer"] as ArrayLike<unknown>[] | undefined) ?? []).map((call) => Array.from(call))

/** The calls Meta's pixel queued. */
export const metaCalls = (win: Record<string, unknown>) =>
  ((win["fbq"] as { queue: unknown[][] } | undefined)?.queue ?? []).map((call) => Array.from(call))

/** The GA4 events sent, as [name, params]. */
export const ga4Events = (win: Record<string, unknown>) =>
  layer(win)
    .filter((call) => call[0] === "event")
    .map((call) => [call[1], call[2]] as [string, Record<string, unknown>])
