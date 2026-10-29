import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { salesReportQuery } from "@/features/reports/api/sales"
import { rangeOf } from "@/features/reports/range"

const route = getRouteApi("/_auth/reports")

/** The report every tab reads: the range in the address, one request the tabs share. */
export function useReport() {
  return useQuery(salesReportQuery(rangeOf(route.useSearch())))
}

/** The range in the address, as the report and its files read it. */
export function useReportRange() {
  return rangeOf(route.useSearch())
}
