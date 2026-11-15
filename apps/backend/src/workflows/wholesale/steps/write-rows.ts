import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { toMedusaAmount } from "../../../lib/money"
import type { Kurus } from "../../../lib/money"

/**
 * A wholesale list's rows written through the pricing module (ADR-0068
 * §4): one call each, every one undone by its compensation. A private
 * list's rows carry its group as a price rule (Ek 2026-11-15), which
 * Medusa's price list batch route does not take.
 */

export interface RowWriteBase {
  price_list_id: string
  currency_code: string
  /** The private list's group as a price rule; null for a level's rows. */
  rules: Record<string, string> | null
}

interface Row {
  price_set_id: string
  amount: Kurus
}

const lira = (amount: Kurus): number => Number(toMedusaAmount(amount))

const priceOf = (base: RowWriteBase, row: Row) => ({
  price_set_id: row.price_set_id,
  currency_code: base.currency_code,
  amount: lira(row.amount),
  ...(base.rules ? { rules: base.rules } : {}),
})

export const createListRowsStep = createStep(
  "wholesale-create-list-rows",
  async (input: RowWriteBase & { rows: Row[] }, { container }) => {
    if (input.rows.length === 0) {
      return new StepResponse([] as string[], [] as string[])
    }
    const created = await container.resolve(Modules.PRICING).addPriceListPrices([
      {
        price_list_id: input.price_list_id,
        prices: input.rows.map((row) => priceOf(input, row)),
      },
    ])
    const ids = created.map((price) => price.id)
    return new StepResponse(ids, ids)
  },
  async (ids, { container }) => {
    if (ids && ids.length > 0) {
      await container.resolve(Modules.PRICING).removePrices(ids)
    }
  }
)

interface RowUpdate extends Row {
  id: string
  /** What it was, for the compensation. */
  before: Kurus
}

export const updateListRowsStep = createStep(
  "wholesale-update-list-rows",
  async (input: RowWriteBase & { rows: RowUpdate[] }, { container }) => {
    if (input.rows.length > 0) {
      await container.resolve(Modules.PRICING).updatePriceListPrices([
        {
          price_list_id: input.price_list_id,
          prices: input.rows.map((row) => ({ id: row.id, ...priceOf(input, row) })),
        },
      ])
    }
    return new StepResponse(input.rows.length, input)
  },
  async (input, { container }) => {
    if (input && input.rows.length > 0) {
      await container.resolve(Modules.PRICING).updatePriceListPrices([
        {
          price_list_id: input.price_list_id,
          prices: input.rows.map((row) => ({
            id: row.id,
            ...priceOf(input, { ...row, amount: row.before }),
          })),
        },
      ])
    }
  }
)

export const deleteListRowsStep = createStep(
  "wholesale-delete-list-rows",
  async (input: RowWriteBase & { rows: (Row & { id: string })[] }, { container }) => {
    if (input.rows.length > 0) {
      await container.resolve(Modules.PRICING).removePrices(input.rows.map((row) => row.id))
    }
    return new StepResponse(input.rows.length, input)
  },
  // The rows come back with new ids: nothing refers to a price row's id
  async (input, { container }) => {
    if (input && input.rows.length > 0) {
      await container.resolve(Modules.PRICING).addPriceListPrices([
        {
          price_list_id: input.price_list_id,
          prices: input.rows.map((row) => priceOf(input, row)),
        },
      ])
    }
  }
)
