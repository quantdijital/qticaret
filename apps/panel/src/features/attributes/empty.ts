import type { AttributeValue } from "@/features/attributes/types"

/** A field left empty: nothing typed, picked or ticked. */
export const isEmpty = (value: AttributeValue | undefined) =>
  value === null ||
  value === undefined ||
  value === "" ||
  (Array.isArray(value) && value.length === 0)
