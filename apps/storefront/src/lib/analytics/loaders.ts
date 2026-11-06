/**
 * GA4's and Meta's own loaders, written out (no library): each queue is
 * ready at once, so events wait in it, and the tag's script is added with
 * the response's nonce only once the page has loaded and the browser is
 * idle: it never competes with the page's largest picture, and it draws
 * nothing (no layout shift).
 */

type Command = (...args: unknown[]) => void

interface MetaQueue extends Command {
  callMethod?: Command
  queue: unknown[]
  push: MetaQueue
  loaded: boolean
  version: string
  disablePushState?: boolean
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Command
    fbq?: MetaQueue
    _fbq?: MetaQueue
  }
}

const GTAG = "https://www.googletagmanager.com/gtag/js"
const FBEVENTS = "https://connect.facebook.net/en_US/fbevents.js"
/** At most this long after the load before the scripts go in, idle or not. */
const IDLE_TIMEOUT = 4000

/** The ids whose tags were started in this page. */
export const loaded: { ga4: string | null; meta: string | null } = { ga4: null, meta: null }

/** Runs once the page has loaded and the browser has a moment. */
function whenIdle(run: () => void): void {
  const idle = () => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: IDLE_TIMEOUT })
    } else {
      window.setTimeout(run, 0)
    }
  }
  if (document.readyState === "complete") {
    idle()
  } else {
    window.addEventListener("load", idle, { once: true })
  }
}

function inject(src: string, nonce: string | undefined): void {
  whenIdle(() => {
    const script = document.createElement("script")
    script.async = true
    script.src = src
    if (nonce) {
      script.nonce = nonce
    }
    document.head.appendChild(script)
  })
}

const grant = (yes: boolean) => (yes ? "granted" : "denied")

export function startGa4(id: string, adSignals: boolean, nonce: string | undefined): void {
  window.dataLayer = window.dataLayer ?? []
  if (!window.gtag) {
    window.gtag = function gtag() {
      // gtag.js reads the arguments object itself, not an array
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments)
    }
    // Consent Mode v2: everything denied before the tag reads anything
    window.gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
    })
  }
  window.gtag("consent", "update", {
    analytics_storage: "granted",
    ad_storage: grant(adSignals),
    ad_user_data: grant(adSignals),
    ad_personalization: grant(adSignals),
  })
  ;(window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = false
  if (loaded.ga4 !== id) {
    window.gtag("js", new Date())
    // Page views are ours, one per route (the router changes pages without a load)
    window.gtag("config", id, { send_page_view: false })
    inject(`${GTAG}?id=${encodeURIComponent(id)}`, nonce)
    loaded.ga4 = id
  }
}

export function startMeta(id: string, nonce: string | undefined): void {
  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) {
        fbq.callMethod(...args)
      } else {
        fbq.queue.push(args)
      }
    } as MetaQueue
    fbq.push = fbq
    fbq.loaded = true
    fbq.version = "2.0"
    fbq.queue = []
    // Page views are ours, one per route: the pixel must not count history changes itself
    fbq.disablePushState = true
    window.fbq = fbq
    window._fbq = window._fbq ?? fbq
    inject(FBEVENTS, nonce)
  }
  window.fbq("consent", "grant")
  if (loaded.meta !== id) {
    // Only the events we send: no button scraping
    window.fbq("set", "autoConfig", false, id)
    window.fbq("init", id)
    loaded.meta = id
  }
}

/** A tag's own cookies, gone once its consent is withdrawn (on this host and the shop's domain). */
function forgetCookies(names: RegExp): void {
  const parts = window.location.hostname.split(".")
  const domains = [
    "",
    ...parts.slice(0, -1).map((_, index) => `; domain=.${parts.slice(index).join(".")}`),
  ]
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim() ?? ""
    if (names.test(name)) {
      for (const domain of domains) {
        document.cookie = `${name}=; max-age=0; path=/${domain}`
      }
    }
  }
}

export function stopGa4(id: string): void {
  window.gtag?.("consent", "update", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  })
  ;(window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = true
  forgetCookies(/^_ga(?:_|$)/)
}

export function stopMeta(): void {
  window.fbq?.("consent", "revoke")
  forgetCookies(/^_fb[pc]$/)
}
