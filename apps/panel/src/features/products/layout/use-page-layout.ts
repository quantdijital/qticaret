import { useState } from "react"
import { flushSync } from "react-dom"
import { revealSection } from "@qticaret/admin-ui/hooks/use-section-open"
import { useProductLayout } from "./api"
import { partOfTarget } from "./parts"
import { goToPart, partBox } from "./use-active-part"
import type { PartKey, ProductLayout } from "./parts"

/** Why a part the shop hid is on the page anyway. */
export type ShownWhy = "attention" | "revealed"

/**
 * The product page's layout as drawn now: the shop's, or the draft being
 * arranged in "Sayfayı düzenle" (the page follows it as it changes). A
 * hidden part keeps its data and is still reached: the advisor's "Alana
 * git" to it shows it for this visit, as does "Göster" under the page,
 * and a part that needs the person (`attention`) is shown anyway.
 */
export function usePageLayout(
  attention: (key: PartKey) => boolean,
  /** Whether a part would draw anything for this product; one that would not is not named as hidden. */
  draws: (key: PartKey) => boolean = () => true
) {
  const saved = useProductLayout()
  const [draft, setDraft] = useState<ProductLayout | null>(null)
  const [revealed, setRevealed] = useState<ReadonlySet<PartKey>>(new Set())
  const layout = draft ?? saved
  const hidden = new Set<PartKey>(layout.hidden)

  /** Null: drawn as laid out; otherwise hidden but drawn, and why; "off": not drawn. */
  const shownWhy = (key: PartKey): ShownWhy | "off" | null => {
    if (!hidden.has(key)) {
      return null
    }
    if (revealed.has(key)) {
      return "revealed"
    }
    return attention(key) ? "attention" : "off"
  }

  /** The parts hidden and not drawn, in page order, for the line under the page. */
  const away = [...layout.main, ...layout.side].filter(
    (key) => shownWhy(key) === "off" && draws(key)
  )

  const showAll = () => {
    setRevealed(new Set([...revealed, ...away]))
  }

  /** The advisor's "Alana git": a hidden part is drawn first, then the page goes to it. */
  const goTo = (target: string) => {
    const part = partOfTarget(target)
    if (part && shownWhy(part) === "off") {
      flushSync(() => {
        setRevealed(new Set([...revealed, part]))
      })
    }
    if (document.getElementById(target)) {
      revealSection(target)
    } else {
      // Drawn just now, its card still loading what it shows: once it is there
      window.setTimeout(() => {
        revealSection(target)
      }, 300)
    }
  }

  /** A part by its key (the section bar, "Alana git" in ⌘K): drawn first if hidden, then gone to. */
  const goToKey = (key: PartKey) => {
    if (shownWhy(key) === "off") {
      flushSync(() => {
        setRevealed(new Set([...revealed, key]))
      })
    }
    if (partBox(key)) {
      goToPart(key)
    } else {
      window.setTimeout(() => {
        goToPart(key)
      }, 300)
    }
  }

  return { saved, layout, draft, setDraft, shownWhy, away, showAll, goTo, goToKey }
}
