import { encodeBasket } from "../client"
import { kurus } from "../../../money"
import {
  installmentRatesHash,
  isNotificationGenuine,
  notificationHash,
  refundHash,
  statusQueryHash,
  tokenRequestHash,
} from "../signatures"

// A plainly fake account (a key that is a word, not a secret); the expected
// values were computed apart from this code (Python's hmac and
// `openssl dgst -sha256 -hmac`) from dev.paytr.com's formulas
const account = {
  merchantId: "100001",
  merchantKey: "testkey-testkey",
  merchantSalt: "testsalt-testsalt",
}

describe("PayTR signatures (known answers)", () => {
  it("signs the token request over the ten documented fields and the salt", () => {
    const basket = encodeBasket([{ name: "Ürün", price: kurus(3456), quantity: 1 }])

    expect(basket).toBe("W1siw5xyw7xuIiwiMzQuNTYiLDFdXQ==")
    expect(
      tokenRequestHash(account, {
        user_ip: "85.105.10.20",
        merchant_oid: "SIP001",
        email: "ayse@example.com",
        payment_amount: "3456",
        user_basket: basket,
        no_installment: "0",
        max_installment: "0",
        currency: "TL",
        test_mode: "1",
      })
    ).toBe("8oPEL1xZsuy8GnjXUr/s0C2XzAoDhY4tovKTvTbcqDU=")
  })

  it("signs a notification as oid + salt + status + total", () => {
    const fields = { merchant_oid: "SIP001", status: "success", total_amount: "3456" }

    expect(notificationHash(account, fields)).toBe("NEkMaB9638Enx/0fD4ZOwJQZ1Z/dawvEW/2nmKbrztk=")
  })

  it("signs the status query, the refund and the installment query", () => {
    expect(statusQueryHash(account, "SIP001")).toBe("qeDpQbH6cxfnvlYfVyWLIqRC1YVYy9SgVzFERdp/olI=")
    expect(refundHash(account, "SIP001", "11.97")).toBe(
      "R+i02wObaNBpDWjGbnd9U05jNDBC/FAf9E6hMyy4nuY="
    )
    expect(installmentRatesHash(account, "req1")).toBe(
      "xzz0CEw1mwn6wDSNi2owwtM3VU6E2qCavZuNtrejnhY="
    )
  })
})

describe("isNotificationGenuine", () => {
  const fields = { merchant_oid: "SIP001", status: "success", total_amount: "3456" }

  it("accepts PayTR's hash", () => {
    expect(
      isNotificationGenuine(account, fields, "NEkMaB9638Enx/0fD4ZOwJQZ1Z/dawvEW/2nmKbrztk=")
    ).toBe(true)
  })

  it.each([
    ["a missing hash", undefined],
    ["an empty hash", ""],
    ["a hash over another amount", notificationHash(account, { ...fields, total_amount: "3457" })],
    ["a hash with another salt", notificationHash({ ...account, merchantSalt: "other" }, fields)],
  ])("refuses %s", (_label, hash) => {
    expect(isNotificationGenuine(account, fields, hash)).toBe(false)
  })
})
