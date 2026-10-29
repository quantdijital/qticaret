import { MedusaService } from "@medusajs/framework/utils"
import { uniqueViolationKeys } from "../../lib/errors"
import type { TrafficSource } from "../../lib/reports/traffic"
import { TrafficSourceRecord } from "./models/traffic-source"

export interface LandingRecord {
  cart_id: string
  source: TrafficSource
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  referrer_host: string | null
}

/** Where carts came from (F11.2): the first landing only, never changed after. */
class TrafficSourcesModuleService extends MedusaService({ TrafficSourceRecord }) {
  /** Keeps the cart's first landing; a later one (another tab, a return) changes nothing. */
  async recordFirst(input: LandingRecord): Promise<{ recorded: boolean }> {
    const [existing] = await this.listTrafficSourceRecords(
      { cart_id: input.cart_id },
      { take: 1, select: ["id"] }
    )
    if (existing) {
      return { recorded: false }
    }
    try {
      await this.createTrafficSourceRecords(input)
      return { recorded: true }
    } catch (error) {
      // Two landings at once: the first one stored stays
      if (uniqueViolationKeys(error)?.includes("cart_id")) {
        return { recorded: false }
      }
      throw error
    }
  }

  /** Each cart's source, for the carts asked about. */
  async sourcesOf(cartIds: readonly string[]): Promise<Map<string, TrafficSource>> {
    if (cartIds.length === 0) {
      return new Map()
    }
    const rows = await this.listTrafficSourceRecords(
      { cart_id: [...cartIds] },
      { select: ["cart_id", "source"] }
    )
    return new Map(rows.map((row) => [row.cart_id, row.source]))
  }
}

export default TrafficSourcesModuleService
