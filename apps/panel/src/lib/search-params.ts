import { defaultStringifySearch } from "@tanstack/react-router"

/**
 * The router's address text, with commas left readable: a filter's several
 * choices show as `?payment=paid,refunded`, not `paid%2Crefunded`. A comma
 * separates nothing in a query, so the address reads back the same.
 */
export const stringifySearch = (search: Record<string, unknown>): string =>
  defaultStringifySearch(search).replaceAll("%2C", ",")
