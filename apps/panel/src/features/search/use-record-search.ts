import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { SEARCH_MIN, globalSearchQuery } from "@/features/search/api"

// Asks once typing pauses, not at every key
const PAUSE_MS = 250

function useSettled(value: string): string {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(value)
    }, PAUSE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [value])
  return settled
}

/**
 * The records' search for these words (F12.9): one query however many
 * ask (the menu's results and its assistant line). `busy` while the
 * typing has not settled or the server has not answered for it.
 */
export function useRecordSearch(search: string) {
  const typed = search.trim()
  const settled = useSettled(typed)
  const query = useQuery({
    ...globalSearchQuery(settled),
    enabled: settled.length >= SEARCH_MIN,
    placeholderData: keepPreviousData,
  })
  const busy = typed.length >= SEARCH_MIN && (settled !== typed || query.isFetching)
  return { typed, settled, query, busy }
}
