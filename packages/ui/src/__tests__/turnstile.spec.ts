// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import type { TurnstileApi, TurnstileOptions } from "../lib/turnstile"
import { TurnstileWidget } from "../lib/turnstile"

/** The widget over Cloudflare's API (adr/0044 Ek 2026-11-24), the API faked. */

function fakeApi() {
  let options: TurnstileOptions = {}
  let made = 0
  const api = {
    render: vi.fn((_el: HTMLElement, given: TurnstileOptions) => {
      options = given
      return "w1"
    }),
    execute: vi.fn(),
    reset: vi.fn(),
    remove: vi.fn(),
  } satisfies TurnstileApi
  const solve = () => {
    made += 1
    ;(options["callback"] as (token: string) => void)(`tok-${String(made)}`)
  }
  const call = (name: string, ...args: unknown[]) =>
    (options[name] as (...given: unknown[]) => unknown)(...args)
  return { api, solve, call, options: () => options }
}

function widgetIn(width: number, api: TurnstileApi, onInteractive = vi.fn()) {
  const parent = document.createElement("div")
  Object.defineProperty(parent, "clientWidth", { value: width })
  const container = document.createElement("div")
  parent.append(container)
  return new TurnstileWidget(api, container, { siteKey: "key", action: "login", onInteractive })
}

describe("TurnstileWidget", () => {
  it("draws managed, seen only for an interaction, run on demand", () => {
    const { api, options } = fakeApi()
    widgetIn(360, api).prepare()

    expect(options()).toMatchObject({
      sitekey: "key",
      action: "login",
      appearance: "interaction-only",
      execution: "execute",
      size: "flexible",
      "response-field": false,
    })
    expect(api.execute).toHaveBeenCalledTimes(1)
  })

  it("takes the compact box where the flexible one's 300 px would not fit (a 320 px phone)", () => {
    const { api, options } = fakeApi()
    widgetIn(288, api).prepare()
    expect(options()["size"]).toBe("compact")
  })

  it("hands each token out once; a spent one resets the widget and prepares the next", async () => {
    const { api, solve } = fakeApi()
    const widget = widgetIn(360, api)

    const first = widget.take()
    solve()
    await expect(first).resolves.toBe("tok-1")

    widget.spent()
    expect(api.reset).toHaveBeenCalledWith("w1")
    expect(api.execute).toHaveBeenCalledTimes(2)
    solve()
    await expect(widget.take()).resolves.toBe("tok-2")
  })

  it("an error or a timed-out interaction fails the waiting send; the next take runs again", async () => {
    const { api, call, solve } = fakeApi()
    const widget = widgetIn(360, api)

    const waiting = widget.take()
    expect(call("error-callback", "300030")).toBe(true)
    await expect(waiting).rejects.toThrow("turnstile: 300030")

    const again = widget.take()
    expect(api.reset).toHaveBeenCalledTimes(1)
    call("timeout-callback")
    await expect(again).rejects.toThrow("timed out")

    const third = widget.take()
    solve()
    await expect(third).resolves.toBe("tok-1")
  })

  it("drops an expired token and says when Cloudflare wants an interaction", async () => {
    const onInteractive = vi.fn()
    const { api, call, solve } = fakeApi()
    const widget = widgetIn(360, api, onInteractive)
    widget.prepare()
    solve()
    call("expired-callback")

    const next = widget.take()
    expect(api.execute).toHaveBeenCalledTimes(2)
    call("before-interactive-callback")
    expect(onInteractive).toHaveBeenLastCalledWith(true)
    call("after-interactive-callback")
    expect(onInteractive).toHaveBeenLastCalledWith(false)
    solve()
    await expect(next).resolves.toBe("tok-2")

    widget.destroy()
    expect(api.remove).toHaveBeenCalledWith("w1")
  })
})
