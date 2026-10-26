import type { DashboardOverview } from "@/features/dashboard/api/overview"

export type ProductSort = "sales" | "units"

export type ReportProduct = DashboardOverview["top_products"][number] & {
  /** Its place among all the period's products in the chosen order, before any search. */
  rank: number
  /** Sales per unit: what one sold for on average, discounts in. */
  average: number
}

const byTitle = (text: string) => text.toLocaleLowerCase("tr").trim()

/** The products in the chosen order, ranked, then narrowed to those whose name holds `query`. */
export function rankedProducts(
  products: DashboardOverview["top_products"],
  sort: ProductSort,
  query: string
): ReportProduct[] {
  const ordered = [...products].sort((a, b) =>
    sort === "units"
      ? b.units - a.units || Number(b.sales) - Number(a.sales)
      : Number(b.sales) - Number(a.sales) || b.units - a.units
  )
  const ranked = ordered.map((product, index) => ({
    ...product,
    rank: index + 1,
    average: product.units > 0 ? Number(product.sales) / product.units : 0,
  }))
  const wanted = byTitle(query)
  return wanted ? ranked.filter((product) => byTitle(product.title).includes(wanted)) : ranked
}
