import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { slugHandles } from "../catalog-handles"

interface Outcome {
  body: unknown
  error: unknown
}

// Mounted with `app.use`, so the full path is only in `originalUrl`
function run(path: string, body: unknown, method = "POST"): Outcome {
  const req = { method, originalUrl: path, path: "/", body } as unknown as MedusaRequest
  let error: unknown = "next not called"
  slugHandles(req, {} as MedusaResponse, (passed?: unknown) => {
    error = passed
  })
  return { body: req.body, error }
}

const reason = (outcome: Outcome): unknown =>
  (outcome.error as { safeMessage?: unknown } | undefined)?.safeMessage

describe("slugHandles", () => {
  it.each([
    ["/admin/products", { title: "Şef Bıçağı 20 cm" }, "sef-bicagi-20-cm"],
    ["/admin/product-categories", { name: "Mutfak Bıçakları" }, "mutfak-bicaklari"],
    ["/admin/collections", { title: "Yılbaşı İndirimi" }, "yilbasi-indirimi"],
  ])("makes the handle of POST %s from its name", (path, body, handle) => {
    const outcome = run(path, body)

    expect(outcome.error).toBeUndefined()
    expect(outcome.body).toMatchObject({ handle })
  })

  it("fills an empty or null handle, and reads the path as Express routes it", () => {
    expect(run("/admin/products", { title: "Çay Bardağı", handle: "" }).body).toMatchObject({
      handle: "cay-bardagi",
    })
    expect(run("/ADMIN/Products/?fields=id", { title: "Çay", handle: null }).body).toMatchObject({
      handle: "cay",
    })
  })

  it("keeps a handle that is a slug", () => {
    expect(run("/admin/products", { title: "Şef Bıçağı", handle: "sef-bicagi-pro" }).body).toEqual({
      title: "Şef Bıçağı",
      handle: "sef-bicagi-pro",
    })
  })

  it.each([
    ["Turkish letters", "şef-bıçağı"],
    ["upper case", "Sef-Bicagi"],
    ["digits only", "12345"],
    ["a slash", "bicak/sef"],
    ["not a string", 42],
  ])("refuses a handle with %s", (_label, handle) => {
    expect(reason(run("/admin/products", { title: "Şef Bıçağı", handle }))).toBe(
      "catalog.handle_invalid"
    )
  })

  it("asks for a handle when the name leaves no slug", () => {
    expect(reason(run("/admin/products", { title: "2024" }))).toBe("catalog.handle_required")
    expect(reason(run("/admin/product-categories", { name: "🔪🔪" }))).toBe(
      "catalog.handle_required"
    )
  })

  it("fills batch creates and checks batch updates", () => {
    const outcome = run("/admin/products/batch", {
      create: [{ title: "Ekmek Bıçağı" }, { title: "Satır", handle: "satir" }],
      update: [{ id: "prod_1", title: "Yeni Ad" }],
    })

    expect(outcome.error).toBeUndefined()
    expect(outcome.body).toMatchObject({
      create: [{ handle: "ekmek-bicagi" }, { handle: "satir" }],
      update: [{ id: "prod_1", title: "Yeni Ad" }],
    })
    expect(
      reason(run("/admin/products/batch", { update: [{ id: "prod_1", handle: "Ekmek" }] }))
    ).toBe("catalog.handle_invalid")
  })

  it("checks a handle sent on update but makes none there", () => {
    expect(run("/admin/products/prod_1", { title: "Yeni Ad" }).body).toEqual({ title: "Yeni Ad" })
    expect(reason(run("/admin/collections/pcol_1", { handle: "Yaz İndirimi" }))).toBe(
      "catalog.handle_invalid"
    )
    expect(
      run("/admin/product-categories/pcat_1", { handle: "yaz-indirimi" }).error
    ).toBeUndefined()
  })

  it("leaves other methods, deeper routes and odd bodies to the core route", () => {
    expect(run("/admin/products", { title: "Şef" }, "GET").body).toEqual({ title: "Şef" })
    expect(run("/admin/products/prod_1/variants", { title: "Şef", handle: "X" }).error).toBe(
      undefined
    )
    expect(run("/admin/products", [{ title: "Şef" }]).error).toBeUndefined()
    expect(run("/admin/products", { title: 7 }).body).toEqual({ title: 7 })
  })
})
