import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { usePrintLabels } from "./print-labels"

const toast = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn() }))
vi.mock("sonner", () => ({ toast }))

describe("usePrintLabels", () => {
  const tab = { close: vi.fn(), opener: {}, location: { href: "" } }

  beforeEach(() => {
    toast.error.mockReset()
    tab.close.mockReset()
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("says what the carrier said when it refuses a label, and closes the empty tab", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "provider_error",
          code: "provider.failed",
          message: "Aras Kargo yanıtı: “Kullanıcı adı veya şifre hatalı”",
          provider: "aras",
          provider_message: "Kullanıcı adı veya şifre hatalı",
        }),
        { status: 502, statusText: "Bad Gateway" }
      )
    )
    const { result } = renderHook(() => usePrintLabels())

    act(() => {
      result.current.print(["ful_1"])
    })

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Aras Kargo yanıtı: “Kullanıcı adı veya şifre hatalı”"
      )
    })
    expect(tab.close).toHaveBeenCalled()
  })
})
