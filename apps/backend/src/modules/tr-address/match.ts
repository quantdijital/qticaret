import { trAsciiFold } from "../../lib/tr/text"

/** Exact key first; otherwise an ASCII-folded match that must be unambiguous. */
export function matchByKey<T extends { match_key: string }>(
  candidates: T[],
  key: string
): T | undefined {
  const exact = candidates.find((candidate) => candidate.match_key === key)
  if (exact) {
    return exact
  }
  const folded = trAsciiFold(key)
  const loose = candidates.filter((candidate) => trAsciiFold(candidate.match_key) === folded)
  return loose.length === 1 ? loose[0] : undefined
}
