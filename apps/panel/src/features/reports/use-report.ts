import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { DEFAULT_PERIOD } from "@/features/dashboard/period"
import { salesReportQuery } from "@/features/reports/api/sales"

const route = getRouteApi("/_auth/reports")

/** The report every tab reads: the period in the address, one request the tabs share. */
export function useReport() {
  const { period = DEFAULT_PERIOD } = route.useSearch()
  return useQuery(salesReportQuery(period))
}
