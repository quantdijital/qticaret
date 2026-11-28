import { useState } from "react"
import { flushSync } from "react-dom"
import { revealSection } from "@qticaret/admin-ui/hooks/use-section-open"
import { useProductLayout } from "./api"
import { TAB_KEYS, isTab, partOfTarget } from "./parts"
import { goToPart, partBox } from "./use-active-part"
import type { PartKey, ProductLayout, TabPart } from "./parts"

/** Why a part the shop hid is on the page anyway. */
export type ShownWhy = "attention" | "revealed"

/** The "Ürün verileri" card's tabs, as the page goes to them. */
export interface DataTabs {
  /** A product without variants: its price and codes are in Genel and Stok. */
  simple: boolean
  /** Opens a tab of the card. */
  open: (tab: TabPart) => void
}

// Its card's content may still be loading when drawn just now: once it is there
const later = (run: () => void, present: boolean) => {
  if (present) {
    run()
  } else {
    window.setTimeout(run, 300)
  }
}

/**
 * The product page's layout as drawn now: the shop's, or the draft being
 * arranged in "Sayfayı düzenle" (the page follows it as it changes). A
 * hidden part keeps its data and is still reached: the advisor's "Alana
 * git" to it shows it for this visit, as does "Göster" under the page,
 * and a part that needs the person (`attention`) is shown anyway. A tab of
 * the data card is a part too: gone to, the card opens it first.
 */
export function usePageLayout(
  attention: (key: PartKey) => boolean,
  /** Whether a part would draw anything for this product; one that would not is not named as hidden. */
  draws: (key: PartKey) => boolean = () => true,
  tabs?: DataTabs,
  /**
   * What the person keeps off over the shop's layout ("Görünüm"): `person`,
   * hidden by them (named under the page, shown anyway when it needs them);
   * `type`, not used by this kind of product and not turned on (not named,
   * not brought up by a finding). Either is still reached by "Alana git".
   */
  own: (key: PartKey) => "person" | "type" | null = () => null
) {
  const saved = useProductLayout()
  const [draft, setDraft] = useState<ProductLayout | null>(null)
  const [revealed, setRevealed] = useState<ReadonlySet<PartKey>>(new Set())
  const layout = draft ?? saved
  const hidden = new Set<PartKey>(layout.hidden)

  /** Null: drawn as laid out; otherwise hidden but drawn, and why; "off": not drawn. */
  const shownWhy = (key: PartKey): ShownWhy | "off" | null => {
    const mine = own(key)
    if (!hidden.has(key) && mine === null) {
      return null
    }
    if (revealed.has(key)) {
      return "revealed"
    }
    // A part its kind does not use is not brought up by a finding (a tour's barcode)
    return attention(key) && (hidden.has(key) || mine === "person") ? "attention" : "off"
  }

  /** The parts hidden and not drawn, in page order, for the line under the page. */
  const away = [...layout.main, ...layout.side, ...TAB_KEYS].filter(
    (key) => shownWhy(key) === "off" && draws(key) && (hidden.has(key) || own(key) === "person")
  )

  const showAll = () => {
    setRevealed(new Set([...revealed, ...away]))
  }

  /** Draws a hidden part first and, for a tab, opens it, before the page goes there. */
  const bringUp = (part: PartKey) => {
    if (shownWhy(part) === "off") {
      flushSync(() => {
        setRevealed(new Set([...revealed, part]))
      })
    }
    if (isTab(part) && tabs) {
      flushSync(() => {
        tabs.open(part)
      })
    }
  }

  /** The advisor's "Alana git": a hidden part is drawn first, then the page goes to it. */
  const goTo = (target: string) => {
    const part = partOfTarget(target, tabs?.simple ?? false)
    if (part) {
      bringUp(part)
    }
    later(
      () => {
        revealSection(target)
      },
      document.getElementById(target) !== null
    )
  }

  /** A part by its key (the section bar, "Alana git" in ⌘K): drawn first if hidden, then gone to. */
  const goToKey = (key: PartKey) => {
    bringUp(key)
    // A tab is gone to on its card
    const box: PartKey = isTab(key) ? "data" : key
    later(
      () => {
        goToPart(box)
      },
      partBox(box) !== null
    )
  }

  return { saved, layout, draft, setDraft, shownWhy, away, showAll, goTo, goToKey }
}
