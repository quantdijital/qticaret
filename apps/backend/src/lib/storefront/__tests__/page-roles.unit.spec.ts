import { storefrontSection } from "../../../modules/platform-settings/sections/storefront"
import {
  handleOfPath,
  roleAnswer,
  roleLookups,
  rolePages,
  roleRefs,
  roleSave,
  rolesAfterPatch,
} from "../page-roles"
import type { RolePage } from "../page-roles"

const CONTACT: RolePage = { id: "cnt_contact", handle: "iletisim", status: "published" }
const PAYMENT: RolePage = { id: "cnt_payment", handle: "odeme-secenekleri", status: "published" }
const SHIPPING: RolePage = { id: "cnt_shipping", handle: "kargo-ve-teslimat", status: "draft" }

const defaults = storefrontSection.defaults as unknown as Record<string, unknown>
const byIds = {
  ...defaults,
  contact_page_id: CONTACT.id,
  payment_page_id: PAYMENT.id,
  shipping_page_id: null,
  contact_form_path: null,
  payment_info_path: null,
  shipping_info_path: null,
}

describe("page roles (adr/0073 Açık kararlar 3)", () => {
  it("reads a handle from a page path, never from a deeper one", () => {
    expect(handleOfPath("/iletisim")).toBe("iletisim")
    expect(handleOfPath(" /Bize-Ulasin/ ")).toBe("bize-ulasin")
    expect(handleOfPath("/blog/yazi")).toBeNull()
    expect(handleOfPath("/")).toBeNull()
  })

  it("keeps a role when its page's address changes: the page is known by its id", () => {
    const renamed = { ...CONTACT, handle: "bize-ulasin" }
    const roles = rolePages(roleRefs(byIds), [renamed, PAYMENT])

    expect(roleLookups(roleRefs(byIds))).toEqual({ ids: [CONTACT.id, PAYMENT.id], handles: [] })
    expect(roles.contact).toEqual(renamed)
    expect(roleAnswer(roles)).toEqual({
      contact_page_id: CONTACT.id,
      payment_page_id: PAYMENT.id,
      shipping_page_id: null,
      contact_form_path: "/bize-ulasin",
      payment_info_path: "/odeme-secenekleri",
      shipping_info_path: null,
    })
  })

  it("still reads a section saved before the ids: the page at the old path", () => {
    const refs = roleRefs(defaults)

    expect(roleLookups(refs)).toEqual({
      ids: [],
      handles: ["iletisim", "odeme-secenekleri", "kargo-ve-teslimat"],
    })
    // A draft has its role, but no address the storefront would link to
    expect(roleAnswer(rolePages(refs, [CONTACT, SHIPPING]))).toEqual({
      contact_page_id: CONTACT.id,
      payment_page_id: null,
      shipping_page_id: SHIPPING.id,
      contact_form_path: "/iletisim",
      payment_info_path: null,
      shipping_info_path: null,
    })
  })

  it("gives a deleted page's role no page, and never reads its old path again", () => {
    const stale = { ...byIds, contact_form_path: "/iletisim" }
    expect(rolePages(roleRefs(stale), [CONTACT]).payment).toBeNull()
    expect(roleLookups(roleRefs(stale)).handles).toEqual([])
  })

  it("writes a page sent by its id and drops the old path", () => {
    const sent = roleSave(defaults, { payment_page_id: PAYMENT.id }, [PAYMENT, CONTACT])
    expect(sent).toEqual({
      fields: {
        contact_page_id: CONTACT.id,
        contact_form_path: null,
        payment_page_id: PAYMENT.id,
        payment_info_path: null,
        // No page at the old address yet: kept, the page may come
        shipping_page_id: null,
        shipping_info_path: "/kargo-ve-teslimat",
      },
      unknown: [],
    })
  })

  it("turns a role off: neither id nor path", () => {
    const { fields } = roleSave(byIds, { contact_page_id: null }, [CONTACT, PAYMENT])
    expect(fields).toMatchObject({ contact_page_id: null, contact_form_path: null })
  })

  it("refuses an id sent anew that is none of the shop's pages, not one stored before", () => {
    expect(roleSave(defaults, { contact_page_id: "cnt_post" }, []).unknown).toEqual([
      "contact_page_id",
    ])
    // The stored payment page was deleted: a save sending it as it is goes on
    const kept = roleSave(byIds, { payment_page_id: PAYMENT.id, contact_page_id: CONTACT.id }, [
      CONTACT,
    ])
    expect(kept.unknown).toEqual([])
    expect(kept.fields["payment_page_id"]).toBe(PAYMENT.id)
  })

  it("reads an old client's path as the role's page by address again", () => {
    const refs = rolesAfterPatch(byIds, { contact_form_path: "/destek" })
    expect(refs.contact).toEqual({ id: null, path: "/destek" })
    const support = { id: "cnt_support", handle: "destek", status: "published" }
    const { fields } = roleSave(byIds, { contact_form_path: "/destek" }, [support, PAYMENT])
    expect(fields).toMatchObject({ contact_page_id: support.id, contact_form_path: null })
  })
})
