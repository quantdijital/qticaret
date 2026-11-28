import { z } from "@medusajs/framework/zod"
import { isSuspended } from "../../../../lib/integrations/suspended"
import { liraAmount } from "../../../validation/lira"

// A flat amount may be nothing: free shipping
const amount = z.union([z.literal(0), liraAmount(100_000, "shipping.amount_invalid")])
const name = z.string().trim().min(1).max(80)

/** A new shipping option: what shoppers see, who carries it (pickup: from the shop), how it is priced (F7.8). */
export const AdminPostShippingOption = z
  .object({
    name,
    // A carrier suspended on this server takes no new option (`lib/integrations/suspended.ts`)
    carrier: z
      .enum(["manual", "aras", "yurtici", "dhlecommerce", "surat", "ptt", "pickup"])
      .refine((carrier) => !isSuspended(carrier), "shipping.option_invalid"),
    pricing: z.discriminatedUnion("type", [
      z.object({ type: z.literal("flat"), amount }).strict(),
      z.object({ type: z.literal("table") }).strict(),
    ]),
  })
  .strict()
export type AdminPostShippingOptionType = z.infer<typeof AdminPostShippingOption>

export const AdminPostShippingOptionUpdate = z
  .object({ name: name.optional(), amount: amount.optional() })
  .strict()
export type AdminPostShippingOptionUpdateType = z.infer<typeof AdminPostShippingOptionUpdate>
