import type { ContentDoc } from "../content"
import { unknownDocTokens, unknownShopTokens } from "../shop/tokens"

/**
 * A campaign's `{belirteç}`s (adr/0050 §4): the shop's details (adr/0048)
 * and `{ad}`, the recipient's first name. Any other is refused on save:
 * misspelt, it would reach thousands as typed.
 */

export const NAME_TOKEN = "ad"
const NAME = /\{ad\}/gu

const withoutName = (names: string[]): string[] => names.filter((name) => name !== NAME_TOKEN)

/** The unknown `{name}`s in a line of the campaign (its subject, its text). */
export const unknownCampaignTokens = (text: string): string[] =>
  withoutName(unknownShopTokens(text))

/** The unknown `{name}`s anywhere in the e-mail's body. */
export const unknownCampaignDocTokens = (doc: ContentDoc): string[] =>
  withoutName(unknownDocTokens(doc))

/**
 * The recipient's name in place of `{ad}`; filled after the shop's
 * details, so nothing in a name is read as a token.
 */
export const fillName = (text: string, name: string): string =>
  text.normalize("NFC").replace(NAME, () => name)
