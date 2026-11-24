/**
 * Cloudflare Turnstile's widget on the panel's sign-in pages (adr/0044 Ek
 * 2026-11-24), a copy of the storefront's (`packages/ui/src/lib/turnstile.ts`):
 * its script loaded once, only when a form asks for it, and one widget per
 * form that hands out one token per send. Managed mode, seen only when
 * Cloudflare wants an interaction (`appearance: "interaction-only"`); the
 * challenge runs when a token is wanted (`execution: "execute"`), so a page
 * that never sends draws nothing and asks nothing of Cloudflare.
 * Options as Cloudflare documents them (client-side rendering, widget
 * configurations).
 */

/** Explicit rendering: the script draws nothing by itself. */
export const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

/** `flexible` is 100% wide but at least 300 px; under that the compact box (150 × 140) fits. */
const FLEXIBLE_MIN_WIDTH = 300

export type TurnstileOptions = Record<string, unknown>

/** The part of Cloudflare's `window.turnstile` used here. */
export interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileOptions) => string | null | undefined
  execute: (container: HTMLElement) => void
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<TurnstileApi> | null = null

/** Cloudflare's script, added once; a failed load may be tried again by the next send. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile)
  }
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = TURNSTILE_SCRIPT_URL
    script.async = true
    script.onload = () => {
      if (window.turnstile) {
        resolve(window.turnstile)
      } else {
        loading = null
        reject(new Error("turnstile: script loaded without its API"))
      }
    }
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error("turnstile: script did not load"))
    }
    document.head.appendChild(script)
  })
  return loading
}

/** Tests start from no script. */
export function forgetTurnstileScript(): void {
  loading = null
}

export interface WidgetSetup {
  siteKey: string
  /** The gate's name (adr/0044 Ek): Cloudflare puts it in the token, the backend checks it. */
  action: string
  language?: string
  theme?: "auto" | "light" | "dark"
  /** Cloudflare wants the visitor to do something (true), or no longer (false). */
  onInteractive?: (interactive: boolean) => void
}

interface Waiter {
  resolve: (token: string) => void
  reject: (error: Error) => void
}

/**
 * One widget in its container. `take()` gives a token, running the
 * challenge when none is ready; a token is handed out once. `spent()`
 * after the send it went with: the widget is reset and the next token
 * prepared, so a second try (a wrong password) does not wait.
 */
export class TurnstileWidget {
  private id: string | null = null
  private token: string | null = null
  private running = false
  // A token was handed out or expired: the widget wants a reset before it runs again
  private stale = false
  private waiters: Waiter[] = []

  constructor(
    private readonly api: TurnstileApi,
    private readonly container: HTMLElement,
    private readonly setup: WidgetSetup
  ) {}

  private render(): void {
    if (this.id !== null) {
      return
    }
    const width = this.container.parentElement?.clientWidth ?? this.container.clientWidth
    const id = this.api.render(this.container, {
      sitekey: this.setup.siteKey,
      action: this.setup.action,
      appearance: "interaction-only",
      execution: "execute",
      size: width >= FLEXIBLE_MIN_WIDTH ? "flexible" : "compact",
      theme: this.setup.theme ?? "auto",
      language: this.setup.language ?? "auto",
      // Ours to send in a header: no hidden field in the form
      "response-field": false,
      // An expired token is dropped and the next `take()` runs the challenge again
      "refresh-expired": "manual",
      callback: (token: string) => {
        this.running = false
        this.stale = false
        const waiter = this.waiters.shift()
        if (waiter) {
          this.stale = true
          waiter.resolve(token)
          this.rejectRest()
        } else {
          this.token = token
        }
      },
      "error-callback": (code: unknown) => {
        this.fail(`turnstile: ${typeof code === "string" ? code : "error"}`)
        // Handled here: Cloudflare need not report it on the console
        return true
      },
      "expired-callback": () => {
        this.token = null
        this.stale = true
      },
      "timeout-callback": () => {
        this.fail("turnstile: interaction timed out")
      },
      "before-interactive-callback": () => this.setup.onInteractive?.(true),
      "after-interactive-callback": () => this.setup.onInteractive?.(false),
    })
    this.id = typeof id === "string" ? id : null
  }

  private fail(message: string): void {
    this.running = false
    this.stale = true
    this.token = null
    const waiting = this.waiters
    this.waiters = []
    for (const waiter of waiting) {
      waiter.reject(new Error(message))
    }
  }

  // Only one token per run: a second waiter (never in one form) is not left hanging
  private rejectRest(): void {
    if (this.waiters.length > 0) {
      this.fail("turnstile: one token per run")
    }
  }

  /** Runs the challenge unless a token is ready or on its way. */
  prepare(): void {
    this.render()
    if (this.token !== null || this.running) {
      return
    }
    if (this.stale && this.id !== null) {
      this.api.reset(this.id)
    }
    this.stale = false
    this.running = true
    this.api.execute(this.container)
  }

  /** A token for one send. */
  take(): Promise<string> {
    if (this.token !== null) {
      const token = this.token
      this.token = null
      this.stale = true
      return Promise.resolve(token)
    }
    const promise = new Promise<string>((resolve, reject) => {
      this.waiters.push({ resolve, reject })
    })
    this.prepare()
    return promise
  }

  /** The token went with a send: the next one is prepared now. */
  spent(): void {
    this.stale = true
    this.token = null
    this.running = false
    this.prepare()
  }

  destroy(): void {
    this.fail("turnstile: widget removed")
    if (this.id !== null) {
      this.api.remove(this.id)
      this.id = null
    }
  }
}
