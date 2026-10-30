import { z } from "@medusajs/framework/zod"
import { isProviderError } from "../../errors"

/** Paraşüt API v4's answers as the client reads them (JSON:API), and its refusals as codes. */

export const Id = z.string().min(1).max(100)

export const Resource = <T extends z.ZodType>(attributes: T) =>
  z.looseObject({ id: Id, type: z.string(), attributes })

export const One = <T extends z.ZodType>(attributes: T) =>
  z.looseObject({ data: Resource(attributes) })

export const Many = <T extends z.ZodType>(attributes: T) =>
  z.looseObject({ data: z.array(Resource(attributes)).max(25) })

export const Amount = z.union([z.string(), z.number()]).transform(String)

export const InvoiceAttributes = z.looseObject({
  gross_total: Amount.nullish(),
  cancelled: z.boolean().nullish(),
})

// A write's answer: its id is all it must hold, so an odd field never hides a write that was done
export const Created = z.looseObject({ data: z.looseObject({ id: Id }) })

export const DocumentAttributes = z.looseObject({
  uuid: z.string().max(100).nullish(),
  invoice_number: z.string().max(100).nullish(),
  cancellable_until: z.string().max(50).nullish(),
})

export const Invoice = z.looseObject({
  data: z.looseObject({
    id: Id,
    attributes: InvoiceAttributes,
    relationships: z
      .looseObject({
        active_e_document: z
          .looseObject({
            data: z.object({ id: Id, type: z.enum(["e_archives", "e_invoices"]) }).nullish(),
          })
          .optional(),
      })
      .optional(),
  }),
  included: z.array(Resource(DocumentAttributes)).max(10).optional(),
})

export const Job = One(
  z.looseObject({
    status: z.enum(["pending", "running", "done", "error"]),
    errors: z.array(z.string().max(500)).max(20).nullish(),
  })
)

export const Pdf = One(z.looseObject({ url: z.string().max(2000) }))

// The refusals the client acts on, by HTTP status: Paraşüt's titles are its own words
export const BY_STATUS: Readonly<Record<number, string>> = {
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  422: "validation_failed",
}

/** Paraşüt's refusal as a fixed code by its status; another, by its first error's title. */
export const apiError = (body: unknown, status: number): string | undefined => {
  const known = BY_STATUS[status]
  if (known) {
    return known
  }
  const errors = (body as { errors?: { title?: unknown }[] } | null)?.errors
  const title = Array.isArray(errors) ? errors[0]?.title : undefined
  return typeof title === "string"
    ? title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .slice(0, 60)
    : undefined
}

/**
 * A write whose outcome is not known: the request may have done its work
 * (no answer, or one that could not be read). Paraşüt takes no idempotency
 * key, so such a write is never sent again on its own.
 */
export const outcomeUnsure = (error: unknown): boolean =>
  isProviderError(error) &&
  ["outcome_unknown", "invalid_response", "response_too_large", "aborted"].includes(
    error.providerCode
  )
