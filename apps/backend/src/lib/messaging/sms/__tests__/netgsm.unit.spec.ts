import { startFakeNetgsm } from "@qticaret/testing"
import type { FakeNetgsm } from "@qticaret/testing"
import { createNetgsmApi, netgsmAccountOf } from "../netgsm"
import type { NetgsmAccount } from "../netgsm"

describe("Netgsm (adr/0036)", () => {
  let fake: FakeNetgsm
  let account: NetgsmAccount
  const api = () => createNetgsmApi({ baseUrl: fake.url })

  beforeAll(async () => {
    fake = await startFakeNetgsm()
    account = {
      usercode: fake.account.usercode,
      password: fake.account.password,
      msgheader: "MAGAZA",
    }
  })

  afterAll(async () => {
    await fake.close()
  })

  beforeEach(() => {
    fake.messages.length = 0
  })

  it("reads the panel's account: both secrets and a sender name", () => {
    expect(
      netgsmAccountOf({
        settings: { msgheader: " MAGAZA " },
        secrets: { usercode: "u", password: "p" },
      })
    ).toEqual({ usercode: "u", password: "p", msgheader: "MAGAZA" })
    expect(netgsmAccountOf({ settings: {}, secrets: { usercode: "u", password: "p" } })).toBeNull()
  })

  it("sends to a Turkish number, information unfiltered and commercial through İYS", async () => {
    const sent = await api().send(account, {
      to: "+905321234567",
      text: "Siparişiniz <hazır> & yolda",
      commercial: false,
    })
    await api().send(account, { to: "+905321234567", text: "Kampanya", commercial: true })

    expect(sent.jobId).toMatch(/^\d+$/)
    expect(fake.messages.map(({ to, filter }) => [to, filter])).toEqual([
      ["905321234567", "0"],
      ["905321234567", "11"],
    ])
    expect(fake.messages[0]?.text).toBe("Siparişiniz <hazır> & yolda")
  })

  it("refuses with Netgsm's code: a login, a sender name, a limit", async () => {
    const wrongLogin = await api()
      .send(
        { ...account, password: "yanlis" },
        { to: "+905321234567", text: "x", commercial: false }
      )
      .catch((error: unknown) => error)
    const wrongHeader = await api()
      .send(
        { ...account, msgheader: "BASKA" },
        { to: "+905321234567", text: "x", commercial: false }
      )
      .catch((error: unknown) => error)
    fake.queue("85")
    const limited = await api()
      .send(account, { to: "+905321234567", text: "x", commercial: false })
      .catch((error: unknown) => error)

    expect(wrongLogin).toMatchObject({ providerCode: "error_30" })
    expect(wrongHeader).toMatchObject({ providerCode: "error_40" })
    expect(limited).toMatchObject({ providerCode: "error_85" })
    expect(fake.messages).toHaveLength(0)
  })

  it("tells a good account, a sender name not on it, and a wrong login apart", async () => {
    expect(await api().checkAccount(account)).toBe("valid")
    expect(await api().checkAccount({ ...account, msgheader: "magaza" })).toBe("valid")
    expect(await api().checkAccount({ ...account, msgheader: "BASKA" })).toBe("merchant_invalid")
    // The answer's own keys and status code are not names on the account
    expect(await api().checkAccount({ ...account, msgheader: "MSGHEADER" })).toBe(
      "merchant_invalid"
    )
    expect(await api().checkAccount({ ...account, msgheader: "00" })).toBe("merchant_invalid")
    expect(await api().checkAccount({ ...account, password: "yanlis" })).toBe("secret_invalid")
  })
})
