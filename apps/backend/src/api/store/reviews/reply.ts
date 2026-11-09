import type { MedusaContainer } from "@medusajs/framework/types"
import { shopNameRead } from "../../../workflows/messaging/brand"

/** The shop's reply under a review as the storefront shows it: its words, the shop's name, when. */
export interface StoreReviewReply {
  body: string
  author_name: string
  created_at: string
}

interface Replied {
  reply: string | null
  replied_at: Date | string | null
}

/**
 * Each review's reply for the Store API, signed with the shop's name (read
 * once, only when one of them has a reply). Text only: a reply is not a
 * review, and goes into no structured data.
 */
export async function storeRepliesOf<T extends Replied>(
  scope: Pick<MedusaContainer, "resolve">,
  rows: readonly T[]
): Promise<(row: T) => StoreReviewReply | null> {
  const shop = rows.some((row) => row.reply !== null) ? await shopNameRead(scope) : ""
  return (row) =>
    row.reply === null
      ? null
      : {
          body: row.reply,
          author_name: shop,
          created_at: new Date(row.replied_at ?? Date.now()).toISOString(),
        }
}
