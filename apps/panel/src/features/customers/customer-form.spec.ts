import { describe, expect, it } from "vitest"
import { customerFieldsOf, customerSchema } from "./customer-form"
import type { CustomerForm } from "./customer-form"

const filled: CustomerForm = {
  first_name: " Ayşe ",
  last_name: "Yılmaz",
  email: "ayse@example.com",
  phone: "0532 123 45 67",
  company_name: "",
  note: "",
}

describe("the customer window's form", () => {
  it("takes a Turkish phone in the usual spellings, or none", () => {
    for (const phone of [
      "0532 123 45 67",
      "+90 (532) 123-45-67",
      "5321234567",
      "0850 123 45 67",
      "",
    ]) {
      expect(customerSchema.safeParse({ ...filled, phone }).success).toBe(true)
    }
    for (const phone of ["12345", "0532 123", "+44 20 7946 0958"]) {
      const parsed = customerSchema.safeParse({ ...filled, phone })
      expect(parsed.error?.issues[0]?.message).toBe("customers.form.errors.phone")
    }
  })

  it("asks for a valid e-mail", () => {
    expect(customerSchema.safeParse({ ...filled, email: "" }).error?.issues[0]?.message).toBe(
      "customers.form.errors.emailRequired"
    )
    expect(customerSchema.safeParse({ ...filled, email: "ayse@" }).error?.issues[0]?.message).toBe(
      "customers.form.errors.email"
    )
  })

  it("sends empty fields as none, and a member's e-mail never", () => {
    expect(customerFieldsOf(filled, true)).toEqual({
      first_name: "Ayşe",
      last_name: "Yılmaz",
      email: "ayse@example.com",
      phone: "0532 123 45 67",
      company_name: null,
    })
    expect(customerFieldsOf(filled, false)).not.toHaveProperty("email")
  })
})
