import type { Block, ContentDoc } from "../../content"
import type { LegalKind } from "../tokens"
import { cookiePolicy } from "./cookie-policy"
import { distanceSales } from "./distance-sales"
import { membership } from "./membership"
import { preInformation } from "./pre-information"
import { privacyNotice } from "./privacy-notice"
import { returnPolicy } from "./return-policy"
import { shippingPolicy } from "./shipping-policy"

/**
 * Starting drafts for each kind (F13.7, adr/0041 §1): a full text checked
 * against the Turkish law in force on 3 Kasım 2026 (docs/yasal-metinler.md),
 * the shop's facts through its tokens. Not legal advice: each opens with
 * a note for the shop listing what is worth checking with its lawyer;
 * publishing removes the note (the owner, 2026-11-04).
 */
const STARTERS: Record<LegalKind, { title: string; content: Block[] }> = {
  pre_information: preInformation,
  distance_sales: distanceSales,
  privacy_notice: privacyNotice,
  cookie_policy: cookiePolicy,
  return_policy: returnPolicy,
  shipping_policy: shippingPolicy,
  membership,
}

/** A kind's starting draft: title and document. */
export function starterOf(kind: LegalKind): { title: string; body: ContentDoc } {
  const starter = STARTERS[kind]
  return { title: starter.title, body: { type: "doc", content: starter.content } }
}

export { hasStarterNote, withoutStarterNote } from "./blocks"
export { ARBITRATION_LIMIT } from "./shared"
