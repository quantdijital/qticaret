export { MISSING_VALUE, fillLegalDoc } from "./fill"
export { IDENTITY_FIELDS, identityGaps } from "./identity"
export type { IdentityFacts, IdentityField } from "./identity"
export type { LegalValues } from "./fill"
export { CONTRACT_PAYMENTS, linesTable, orderLegalValues } from "./order-values"
export type { ContractPayment, OrderContractFacts, OrderLegalValues } from "./order-values"
export { workingDaysText } from "./shipping-days"
export { ARBITRATION_LIMIT, hasStarterNote, starterOf } from "./starters"
export { personalLinesBlocks, withPersonalLines } from "./withdrawal"
export {
  BLOCK_TOKENS,
  LEGAL_KINDS,
  ORDER_KINDS,
  ORDER_TOKENS,
  PERSONAL_LINES_TOKEN,
  REQUIRED_KINDS,
  SHOP_TOKENS,
  checkLegalDoc,
  isLegalKind,
  tokensFor,
} from "./tokens"
export type { LegalKind, LegalTemplateCheck, OrderToken, ShopToken } from "./tokens"
