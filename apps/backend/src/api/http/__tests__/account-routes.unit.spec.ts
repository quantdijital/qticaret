import { loginEmailOf } from "../account-routes"

/** adr/0037 §1: an account is opened for the address its identity logs in with. */
describe("loginEmailOf", () => {
  it("takes the e-mail login's address first, in one spelling", () => {
    expect(
      loginEmailOf([
        { provider: "google", entity_id: "1234", user_metadata: { email: "baska@example.com" } },
        { provider: "emailpass", entity_id: " Ayse@Example.com " },
      ])
    ).toBe("ayse@example.com")
  })

  it("takes the address a social provider vouched for when there is no e-mail login", () => {
    expect(
      loginEmailOf([
        { provider: "google", entity_id: "1234", user_metadata: { email: "ayse@example.com" } },
      ])
    ).toBe("ayse@example.com")
  })

  it("finds none when no identity names an address", () => {
    expect(
      loginEmailOf([{ provider: "google", entity_id: "1234", user_metadata: null }])
    ).toBeNull()
    expect(loginEmailOf([])).toBeNull()
  })
})
