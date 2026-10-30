export { DIMENSION_FIELDS, missingDimensions } from "./dimensions"
export type { DimensionField, Dimensions } from "./dimensions"
export { isValidGtin, variantGtin } from "./gtin"
export type { VariantCodes } from "./gtin"
export { ID_CHUNK, chunksOf } from "./ids"
export { deepestCategory } from "./categories"
export type { CategoryPlace } from "./categories"
export {
  ADULT_CONSIDERATIONS,
  RESTRICTIONS,
  ageOn,
  isRestriction,
  restrictionOf,
} from "./restrictions"
export type { Restriction } from "./restrictions"
