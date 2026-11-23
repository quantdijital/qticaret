import { useMemo } from "react"
import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { SECTION_REQUIRES } from "@qticaret/types"
import { featuresQuery } from "@/features/settings/api/features"
import { SectionFlagsContext } from "./section-flags"

/**
 * The shop's flags for the editor's flagged sections (adr/0077 §8) and a
 * dated card's theme fields (Ek "tur kartı"), always read: while they
 * load none is on, so a flagged section or field is not offered until known.
 */
export function SectionFlagsProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery(featuresQuery())
  const value = useMemo(
    () => ({
      on: new Set((data ?? []).filter((each) => each.enabled).map((each) => each.key)),
      requires: SECTION_REQUIRES,
    }),
    [data]
  )
  return <SectionFlagsContext.Provider value={value}>{children}</SectionFlagsContext.Provider>
}
