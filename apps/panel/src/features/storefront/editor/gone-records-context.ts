import { createContext, useContext } from "react"

/**
 * The design's parts naming a record deleted since (a category, product,
 * collection, brand or page; the server's `missing_targets`): the
 * storefront leaves the record out and a save goes through ("engel değil
 * uyarı"); the editor marks the part so the shop picks again. Outside the
 * editor none is marked.
 */
export const GoneRecordsContext = createContext<ReadonlySet<string>>(new Set())

export const useGoneRecords = (): ReadonlySet<string> => useContext(GoneRecordsContext)
