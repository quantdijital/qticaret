import { afterEach, describe, expect, it, vi } from "vitest"
import { ReauthCancelled, setReauthAsker, withReauth } from "./reauth"
import type { ReauthAsk } from "./reauth"

const refused = (status: number) => Object.assign(new Error("refused"), { status })

describe("withReauth (adr/0040 §3)", () => {
  afterEach(() => {
    setReauthAsker(null)
  })

  it("makes the call once when no proof is asked", async () => {
    const call = vi.fn().mockResolvedValue("ok")

    await expect(withReauth(call)).resolves.toBe("ok")
    expect(call).toHaveBeenCalledTimes(1)
  })

  it("asks for a proof on a 428, again after a wrong one, and sends it in the headers", async () => {
    const asks: ReauthAsk[] = []
    setReauthAsker((ask) => {
      asks.push(ask)
      ask.answer({ method: "totp", secret: asks.length === 1 ? "000000" : "123456" })
    })
    const call = vi
      .fn()
      .mockRejectedValueOnce(refused(428))
      .mockRejectedValueOnce(refused(428))
      .mockResolvedValueOnce("ok")

    await expect(withReauth(call)).resolves.toBe("ok")
    expect(asks.map((ask) => ask.failed)).toEqual([false, true])
    expect(call).toHaveBeenLastCalledWith({
      headers: { "x-reauth-method": "totp", "x-reauth-secret": "123456" },
    })
  })

  it("gives up when the person closes the dialog, and passes other failures on", async () => {
    setReauthAsker((ask) => {
      ask.answer(null)
    })

    await expect(withReauth(() => Promise.reject(refused(428)))).rejects.toBeInstanceOf(
      ReauthCancelled
    )
    await expect(withReauth(() => Promise.reject(refused(403)))).rejects.toMatchObject({
      status: 403,
    })
  })
})
