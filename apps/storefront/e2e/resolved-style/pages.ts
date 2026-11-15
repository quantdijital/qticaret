import type { Page } from "@playwright/test"

/** A page to capture: its name in the output and its shop path. */
export interface Target {
  name: string
  path: string
}

export interface CaptureOptions {
  out: string
  base: string
  /** A path prefix before every page: `/onizleme/<token>` opens the theme editor's preview. */
  prefix: string
  widths: number[]
  /** Pages captured at once. */
  jobs: number
  pages: Target[] | null
  category: string | null
  product: string | null
  search: string | null
  states: string[] | null
  injectCss: string | null
  addClass: string | null
}

const USAGE = `style:capture -- --out <dir> [--base http://localhost:8000] [--prefix /onizleme/<token>]
  [--widths 390,1440] [--jobs 2] [--pages name=/path,…] [--category /kategori/…] [--product /urun/…]
  [--search <q>] [--states name,…|none] [--inject-css <css>] [--add-class <selector>=<class>]
The prefix may come from STYLE_PREFIX instead, to keep a preview token off the command line.`

/** The command line's options; throws with the usage on a bad one. */
export function parseCaptureArgs(argv: string[], env: NodeJS.ProcessEnv): CaptureOptions {
  const options: CaptureOptions = {
    out: "",
    base: "http://localhost:8000",
    prefix: env["STYLE_PREFIX"] ?? "",
    widths: [390, 1440],
    jobs: 2,
    pages: null,
    category: null,
    product: null,
    search: null,
    states: null,
    injectCss: null,
    addClass: null,
  }
  const args = argv.filter((arg) => arg !== "--")
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i]
    const value = args[i + 1]
    if (value === undefined || !flag?.startsWith("--")) {
      throw new Error(`bad argument ${flag ?? ""}\n${USAGE}`)
    }
    i += 1
    switch (flag) {
      case "--out":
        options.out = value
        break
      case "--base":
        options.base = value.replace(/\/+$/, "")
        break
      case "--prefix":
        options.prefix = value
        break
      case "--widths":
        options.widths = value.split(",").map(Number)
        break
      case "--jobs":
        options.jobs = Number(value)
        break
      case "--pages":
        options.pages = value.split(",").map((each, n) => {
          const [name, path] = each.includes("=") ? each.split("=", 2) : [`page${n + 1}`, each]
          return { name: name ?? `page${n + 1}`, path: path ?? "/" }
        })
        break
      case "--category":
        options.category = value
        break
      case "--product":
        options.product = value
        break
      case "--search":
        options.search = value
        break
      case "--states":
        options.states = value === "none" ? [] : value.split(",")
        break
      case "--inject-css":
        options.injectCss = value
        break
      case "--add-class":
        options.addClass = value
        break
      default:
        throw new Error(`unknown option ${flag}\n${USAGE}`)
    }
  }
  if (!options.out) {
    throw new Error(`--out is required\n${USAGE}`)
  }
  if (options.widths.some((w) => !Number.isInteger(w) || w < 200)) {
    throw new Error("--widths takes whole pixel widths, e.g. 390,1440")
  }
  if (!Number.isInteger(options.jobs) || options.jobs < 1) {
    throw new Error("--jobs takes a whole number, 1 or more")
  }
  options.prefix = options.prefix.replace(/\/+$/, "")
  return options
}

/**
 * The address of a shop path. Under the theme editor's preview
 * (`/onizleme/<token>`) the page is its `?sayfa=` (adr/0049: the home page
 * for none); under any other prefix the path follows it.
 */
export function pageUrl(base: string, prefix: string, path: string): string {
  if (prefix.startsWith("/onizleme/")) {
    return path === "/" ? `${base}${prefix}` : `${base}${prefix}?sayfa=${encodeURIComponent(path)}`
  }
  return `${base}${prefix}${path}`
}

/** Hides the prefix (a preview token) in anything printed or written. */
export function redactor(prefix: string): (text: string) => string {
  if (!prefix) {
    return (text) => text
  }
  const encoded = encodeURIComponent(prefix)
  return (text) => text.split(prefix).join("<prefix>").split(encoded).join("<prefix>")
}

/** A link's shop path: a preview's `?sayfa=` when it has one. */
function shopPath(href: string): string | null {
  try {
    const url = new URL(href)
    return url.searchParams.get("sayfa") ?? url.pathname + url.search
  } catch {
    return null
  }
}

/**
 * The default pages: home, the first category and product the home page
 * links to (unless given), the cart, and a search for the first word of
 * that product's card.
 */
export async function discoverTargets(page: Page, options: CaptureOptions): Promise<Target[]> {
  if (options.pages) {
    return options.pages
  }
  const links = await page
    .getByRole("main")
    .locator("a[href]")
    .evaluateAll((all) =>
      all.map((a) => ({ href: (a as HTMLAnchorElement).href, text: a.textContent }))
    )
  const found = links.map((link) => ({ ...link, path: shopPath(link.href) ?? "" }))
  const category = options.category ?? found.find((l) => l.path.startsWith("/kategori/"))?.path
  const productLink = found.find((l) => l.path.startsWith("/urun/"))
  const product = options.product ?? productLink?.path
  const word =
    options.search ??
    productLink?.text.match(/\p{L}{3,}/u)?.[0] ??
    product?.split("/")[2]?.split("-")[0] ??
    "a"
  const targets: Target[] = [{ name: "home", path: "/" }]
  if (category) {
    targets.push({ name: "category", path: category })
  }
  if (product) {
    targets.push({ name: "product", path: product })
  }
  targets.push({ name: "cart", path: "/sepet" })
  targets.push({
    name: "search",
    path: `/arama?q=${encodeURIComponent(word.toLocaleLowerCase("tr"))}`,
  })
  return targets
}
