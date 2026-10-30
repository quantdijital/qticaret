import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { withReauth } from "@/lib/reauth"
import { ReauthHost } from "./reauth-host"

const staff = vi.hoisted(() => ({ mfa: { enabled: false } }))

vi.mock("@/features/auth/api/staff", () => ({ useStaff: () => staff }))

const asked = Object.assign(new Error("reauth"), { status: 428 })

/** A change that needs a proof: refused until its headers carry the expected one. */
function sensitive(expected: Record<string, string>) {
  const call = vi.fn((extra: { headers?: Record<string, string> }) =>
    extra.headers?.["x-reauth-secret"] === expected["x-reauth-secret"] &&
    extra.headers?.["x-reauth-method"] === expected["x-reauth-method"]
      ? Promise.resolve("done")
      : Promise.reject(asked)
  )
  return { call, result: withReauth(call) }
}

describe("ReauthHost", () => {
  beforeEach(() => {
    staff.mfa.enabled = false
  })

  it("asks one without 2FA for their password, says when it is wrong, and goes on with the right one", async () => {
    const user = userEvent.setup()
    render(<ReauthHost />)
    const { call, result } = sensitive({
      "x-reauth-method": "password",
      "x-reauth-secret": "dogru",
    })

    await user.type(await screen.findByLabelText("Şifre"), "yanlis")
    await user.click(screen.getByRole("button", { name: "Doğrula" }))
    const wrong = await screen.findByRole("alert")
    await user.type(screen.getByLabelText("Şifre"), "dogru")
    await user.click(screen.getByRole("button", { name: "Doğrula" }))

    expect(wrong).toHaveTextContent("Şifre doğru değil; yeniden deneyin.")
    await expect(result).resolves.toBe("done")
    expect(call).toHaveBeenCalledTimes(3)
  })

  it("asks one with 2FA for the app's code, or a recovery code instead", async () => {
    staff.mfa.enabled = true
    const user = userEvent.setup()
    render(<ReauthHost />)
    const { result } = sensitive({
      "x-reauth-method": "recovery_code",
      "x-reauth-secret": "ABCD-1234",
    })

    expect(await screen.findByLabelText("Doğrulama kodu")).toBeInTheDocument()
    expect(screen.queryByLabelText("Şifre")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Kurtarma kodu kullan" }))
    await user.type(screen.getByLabelText("Kurtarma kodu"), "ABCD-1234")
    await user.click(screen.getByRole("button", { name: "Doğrula" }))

    await expect(result).resolves.toBe("done")
  })

  it("makes no change when the person closes it", async () => {
    const user = userEvent.setup()
    render(<ReauthHost />)
    const { call, result } = sensitive({
      "x-reauth-method": "password",
      "x-reauth-secret": "dogru",
    })

    // Caught at once: the rejection comes while the click is still being made
    const outcome = result.catch((error: unknown) => error)
    await user.click(await screen.findByRole("button", { name: "Vazgeç" }))

    expect(await outcome).toMatchObject({ cancelled: true })
    expect(call).toHaveBeenCalledTimes(1)
  })
})
