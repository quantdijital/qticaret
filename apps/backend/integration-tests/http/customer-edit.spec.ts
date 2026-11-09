import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { ORDER_NOTES_MODULE } from "../../src/modules/order-notes"
import type OrderNotesModuleService from "../../src/modules/order-notes/service"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

interface Customer {
  id: string
  email: string
  phone: string | null
  first_name: string | null
  has_account: boolean
  addresses?: { id: string; city: string; province: string; address_2: string | null }[]
}

interface Who {
  headers: Record<string, string>
}

const email = (name: string) => `${name}-${randomUUID().slice(0, 8)}@example.com`

const ADDRESS = {
  first_name: "Ayşe",
  last_name: "Yılmaz",
  address_1: "Moda Cad. No: 5",
  address_2: "Caferağa",
  city: "Kadıköy",
  province: "İstanbul",
  postal_code: "34710",
  country_code: "tr",
  phone: "0532 123 45 67",
}

/** 2026-11-06: staff edit customers and add guests; a member's e-mail stays theirs. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Who

    const post = <T>(path: string, body: unknown, who: Who = owner) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: who.headers }))
    const create = (body: Record<string, unknown>, who: Who = owner) =>
      post<{ customer: Customer }>("/admin/customers", body, who)
    const update = (id: string, body: Record<string, unknown>, who: Who = owner) =>
      post<{ customer: Customer }>(`/admin/customers/${id}`, body, who)

    beforeEach(async () => {
      await loadTrAddressFixture(getContainer())
      owner = await createAdminUser(http, getContainer())
    })

    it("adds a guest with a Turkish phone; no account, no second guest on the address", async () => {
      const address = email("misafir")
      const made = await create({
        email: address,
        first_name: "Ayşe",
        last_name: "Yılmaz",
        phone: "0532 123 45 67",
      })
      const again = await create({ email: address, first_name: "Başka" })
      const badPhone = await create({ email: email("tel"), phone: "12345" })
      const member = await create({ email: email("uye"), has_account: true })

      expect(made.status).toBe(200)
      expect(made.data.customer).toMatchObject({ has_account: false, phone: "+905321234567" })
      expect(again.status).toBe(409)
      expect(again.data.message).toBe("customers.email_taken")
      expect(badPhone.status).toBe(400)
      expect(badPhone.data.message).toBe("customers.phone_invalid")
      expect(member.status).toBe(400)
    })

    it("corrects a guest's e-mail; a member's is their sign-in and stays theirs", async () => {
      const guest = (await create({ email: email("misafir") })).data.customer
      const storefront = await createStorefront(getContainer())
      const registered = await registerCustomer(http, storefront)

      const moved = await update(guest.id, { email: email("yeni"), first_name: "Elif" })
      const memberEmail = await update(registered.id, { email: email("baska") })
      // The same address (another case) with a name change goes through
      const memberName = await update(registered.id, {
        email: registered.email.toUpperCase(),
        first_name: "Zeynep",
        phone: "+90 (532) 765 43 21",
      })

      expect(moved.status).toBe(200)
      expect(moved.data.customer.first_name).toBe("Elif")
      expect(memberEmail.status).toBe(400)
      expect(memberEmail.data.message).toBe("customers.email_is_login")
      expect(memberName.status).toBe(200)
      expect(memberName.data.customer).toMatchObject({
        email: registered.email,
        first_name: "Zeynep",
        phone: "+905327654321",
      })
      // The audit log keeps the field names, never their values
      const entries = await eventually(
        () =>
          getContainer()
            .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
            .listAuditEntries({ resource_id: registered.id, kind: "mutation" }),
        (rows) => rows.length >= 2
      )
      const changes = entries.map((entry) => JSON.stringify(entry.changes))
      expect(changes.some((text) => text.includes("first_name"))).toBe(true)
      expect(changes.some((text) => text.includes("Zeynep"))).toBe(false)
    })

    it("adds, changes and deletes addresses checked against the Turkish list", async () => {
      const guest = (await create({ email: email("adres") })).data.customer
      const path = `/admin/customers/${guest.id}/addresses`

      const withAddresses = "?fields=*addresses"
      const added = await post<{ customer: Customer }>(`${path}${withAddresses}`, ADDRESS)
      const wrong = await post(path, { ...ADDRESS, city: "Çankaya" })
      const addressId = added.data.customer.addresses?.[0]?.id ?? ""
      const one = `${path}/${addressId}`
      const moved = await post<{ customer: Customer }>(`${one}${withAddresses}`, {
        address_2: "Fenerbahçe",
        postal_code: "34726",
      })
      const movedWrong = await post(one, { city: "Polatlı" })
      const removed = await settle(http.delete(one, { headers: owner.headers }))
      const after = await http.get<{ customer: Customer }>(
        `/admin/customers/${guest.id}${withAddresses}`,
        { headers: owner.headers }
      )

      expect(addressId).not.toBe("")
      expect(added.status).toBe(200)
      expect(wrong.status).toBe(400)
      expect(moved.status).toBe(200)
      expect(moved.data.customer.addresses?.[0]?.address_2).toBe("Fenerbahçe")
      expect(movedWrong.status).toBe(400)
      expect(removed.status).toBe(200)
      expect(after.data.customer.addresses).toEqual([])
    })

    it("keeps the team's note; operations write, read-only staff do not", async () => {
      const operations = await createAdminUser(http, getContainer(), "operations")
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      const guest = (await create({ email: email("not") }, operations)).data.customer
      const notePath = `/admin/customers/${guest.id}/note`

      const written = await post<{ note: { body: string; updated_by: string } }>(
        notePath,
        { body: "  Kapıda ödeme ister.  " },
        operations
      )
      const read = await http.get<{ note: { body: string } }>(notePath, {
        headers: readonly.headers,
      })
      const byReadonly = await post(notePath, { body: "Deneme" }, readonly)
      const editByReadonly = await update(guest.id, { first_name: "X" }, readonly)
      const tooLong = await post(notePath, { body: "x".repeat(2001) })
      const unknown = await post("/admin/customers/cus_yok/note", { body: "Not" })
      const emptied = await post<{ note: { body: string } }>(notePath, { body: "" })

      expect(written.status).toBe(200)
      expect(written.data.note).toMatchObject({
        body: "Kapıda ödeme ister.",
        updated_by: operations.userId,
      })
      expect(read.data.note.body).toBe("Kapıda ödeme ister.")
      expect(byReadonly.status).toBe(403)
      expect(editByReadonly.status).toBe(403)
      expect(tooLong.status).toBe(400)
      expect(unknown.status).toBe(404)
      expect(emptied.data.note.body).toBe("")
      // Emptied: its text is gone from the row too
      const rows = await getContainer()
        .resolve<OrderNotesModuleService>(ORDER_NOTES_MODULE)
        .listCustomerNotes({ customer_id: guest.id }, { withDeleted: true })
      expect(rows.map((row) => row.body)).toEqual([""])
    })
  },
})
