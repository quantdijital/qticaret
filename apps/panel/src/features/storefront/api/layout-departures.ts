import type { DeparturesSettings, DeparturesSource, StoreHeadLines } from "@qticaret/types"
import type { BodySectionBase } from "@/features/storefront/api/layout-sections"

// Upcoming departures of the theme editor's document (adr/0077 §10)

/**
 * The nearest departures of the shop's dated products, read live by the
 * storefront; a flagged section (`catalog.booking`, adr/0077 §8). Whose:
 * every dated product's, a category's or a collection's (`""`: none
 * chosen yet, a problem the form names).
 */
export type DeparturesSection = BodySectionBase & {
  type: "departures"
  /** None: the storefront's own words ("Yaklaşan kalkışlar"). */
  title: string | null
  intro: string | null
  source: DeparturesSource
  limit: number
} & DeparturesSettings &
  StoreHeadLines
