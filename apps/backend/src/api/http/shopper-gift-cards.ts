import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { GIFT_CARDS } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { restrictStoreRelation } from "../validation/attribute-fields"

/**
 * What a shopper sees of a gift card (F4.8, ADR-0025): its code, value,
 * state and end, and what its credit has left. The shop's note, the card's
 * reference and metadata, the line it was bought on and its account's owner
 * stay inside. The loyalty plugin opens a cart's or an order's cards to
 * `fields` on every Store route, and its own routes answer with every
 * field of a card by default (the lookup by code, a cart's `*gift_cards`).
 */
const CARD_FIELDS = [
  "id",
  "code",
  "status",
  "value",
  "currency_code",
  "expires_at",
  "created_at",
  "updated_at",
] as const
const ACCOUNT_FIELDS = ["currency_code", "balance", "credits", "debits"] as const

export const STORE_GIFT_CARD_LEAVES = [
  ...CARD_FIELDS.map((field) => `gift_cards.${field}`),
  ...ACCOUNT_FIELDS.map((field) => `gift_cards.store_credit_account.${field}`),
]

// Anywhere in a token and in any case: `GIFT_CARDS.note` is refused, not read
const GIFT_CARD_RELATION = /gift_cards/iu
const whileOn = restrictStoreRelation(
  GIFT_CARD_RELATION,
  STORE_GIFT_CARD_LEAVES,
  "gift_card_fields"
)
// Off, no field of a card exists, as for a shop without the plugin (adr/0012)
const whileOff = restrictStoreRelation(GIFT_CARD_RELATION, [], "gift_card_fields")

/** A cart's or an order's cards in Store `fields`: the leaves above, named one by one. */
export async function restrictStoreGiftCardFields(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const fields: unknown = req.query["fields"]
  // A string, a list or (refused later by Medusa) an object: each read as text
  if (!GIFT_CARD_RELATION.test(JSON.stringify(fields ?? ""))) {
    next()
    return
  }
  let on: boolean
  try {
    on = await req.scope
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .isFeatureEnabled(GIFT_CARDS)
  } catch (error) {
    next(error)
    return
  }
  ;(on ? whileOn : whileOff)(req, res, next)
}

type Row = Record<string, unknown>

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const pick = (row: Row, fields: readonly string[]): Row =>
  Object.fromEntries(fields.filter((field) => field in row).map((field) => [field, row[field]]))

export function shopperGiftCard(card: unknown): unknown {
  if (!isRow(card)) {
    return card
  }
  const shown = pick(card, CARD_FIELDS)
  const account = card["store_credit_account"]
  if (isRow(account)) {
    shown["store_credit_account"] = pick(account, ACCOUNT_FIELDS)
  }
  return shown
}

const shopperCards = (cards: unknown): unknown =>
  Array.isArray(cards) ? cards.map(shopperGiftCard) : cards

/** A Store answer of the plugin's routes with its cards cut down: the lookup's card, a cart's cards. */
export function shopperBody(body: unknown): unknown {
  if (!isRow(body)) {
    return body
  }
  if ("gift_card" in body) {
    return { ...body, gift_card: shopperGiftCard(body["gift_card"]) }
  }
  const cart = body["cart"]
  if (isRow(cart) && "gift_cards" in cart) {
    return { ...body, cart: { ...cart, gift_cards: shopperCards(cart["gift_cards"]) } }
  }
  return body
}

/** On the plugin's Store routes: their answers cut down, whatever `fields` asked for. */
export function shopperGiftCardAnswers(
  _req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const json = res.json.bind(res)
  res.json = (body: unknown) => json(shopperBody(body))
  next()
}
