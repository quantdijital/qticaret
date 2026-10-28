import { z } from "@medusajs/framework/zod"
import { segmentRules } from "../../../lib/customers/segments"

const name = z.string().trim().min(1).max(100)

/** A segment: its name, which its group carries too, and its rules. */
export const AdminPostCustomerSegment = z.object({ name, rules: segmentRules }).strict()
export type AdminPostCustomerSegmentType = z.infer<typeof AdminPostCustomerSegment>

/** A segment renamed, or given new rules. */
export const AdminUpdateCustomerSegment = z
  .object({ name: name.optional(), rules: segmentRules.optional() })
  .strict()
export type AdminUpdateCustomerSegmentType = z.infer<typeof AdminUpdateCustomerSegment>
