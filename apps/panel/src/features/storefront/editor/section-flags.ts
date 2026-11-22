import { createContext, useContext } from "react"
import { NO_FLAGS } from "@/features/storefront/layout/sections"
import type { SectionFlags } from "@/features/storefront/layout/sections"

/**
 * The shop's flags for flagged sections (adr/0077 §8), given by the editor
 * (`SectionFlagsProvider`); outside one (a part drawn alone) none is on and
 * the contract's list applies, so nothing flagged is offered.
 */
export const SectionFlagsContext = createContext<SectionFlags>(NO_FLAGS)

export const useSectionFlags = (): SectionFlags => useContext(SectionFlagsContext)
