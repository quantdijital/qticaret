import { validateAndTransformBody } from "@medusajs/framework/http"
import { AdminPostSearchSynonym } from "../validators"

// What Medusa's body validation hands the error handler for a group
async function refusalOf(body: unknown): Promise<string | null> {
  let caught: unknown = null
  await validateAndTransformBody(AdminPostSearchSynonym)(
    { body } as never,
    {} as never,
    (error?: unknown) => {
      caught = error ?? null
    }
  )
  return (caught as { message?: string } | null)?.message ?? null
}

describe("AdminPostSearchSynonym", () => {
  it("refuses a group's size and a term's length with their keys, not Medusa's wording", async () => {
    const eleven = Array.from({ length: 11 }, (_, at) => `terim${String(at)}`)
    expect(await refusalOf({ terms: ["tek"] })).toBe(
      "Invalid request: search.synonym_terms_too_few"
    )
    expect(await refusalOf({ terms: eleven })).toBe(
      "Invalid request: search.synonym_terms_too_many"
    )
    expect(await refusalOf({ terms: ["k".repeat(61), "kupa"] })).toBe(
      "Invalid request: search.synonym_term_length"
    )
  })

  it("takes two to ten terms of up to 60 characters, trimmed", async () => {
    expect(await refusalOf({ terms: [` ${"k".repeat(60)} `, "kupa"] })).toBeNull()
    expect(
      await refusalOf({ terms: Array.from({ length: 10 }, (_, at) => `t${String(at)}`) })
    ).toBeNull()
  })
})
