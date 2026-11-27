import { startFakeGoogle } from "@qticaret/testing"
import type { FakeGoogle } from "@qticaret/testing"
import { authorizationUrl, pkcePair } from "../oauth"

/**
 * The local Google's Merchant Center account (packages/testing): fixed for a
 * developer's runner and listed through Merchant API's accounts.list, as
 * the real one is, so the shop can find and name it.
 */
describe("fake Google's Merchant Center account", () => {
  let google: FakeGoogle
  const redirectUri = "http://localhost:5173/google/callback"

  beforeAll(async () => {
    google = await startFakeGoogle({ merchantId: "5432109876" })
  })

  afterAll(async () => {
    await google.close()
  })

  const accessToken = async () => {
    const { verifier, challenge } = pkcePair()
    const back = new URL(
      await google.consent(
        authorizationUrl(google.client, { state: "s", challenge, redirectUri }, google.url)
      )
    )
    const answer = await fetch(`${google.url}/token`, {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: back.searchParams.get("code") ?? "",
        code_verifier: verifier,
        client_id: google.client.clientId,
        client_secret: google.client.clientSecret,
        redirect_uri: redirectUri,
      }),
    })
    return ((await answer.json()) as { access_token: string }).access_token
  }

  it("keeps the account it was given and lists it to the connected Google account", async () => {
    const token = await accessToken()
    const listed = await fetch(`${google.url}/accounts/v1/accounts`, {
      headers: { authorization: `Bearer ${token}` },
    })
    const stranger = await fetch(`${google.url}/accounts/v1/accounts`)

    expect(google.merchantId).toBe("5432109876")
    expect(await listed.json()).toMatchObject({
      accounts: [{ name: "accounts/5432109876", accountId: "5432109876" }],
    })
    expect(stranger.status).toBe(401)
  })

  it("picks a random account unless one is given", async () => {
    const other = await startFakeGoogle()
    try {
      expect(other.merchantId).toMatch(/^\d{9}$/)
    } finally {
      await other.close()
    }
  })
})
