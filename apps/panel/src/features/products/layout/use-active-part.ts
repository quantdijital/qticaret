import { useEffect, useState } from "react"
import { revealSection } from "@qticaret/admin-ui/hooks/use-section-open"
import type { PartKey } from "./parts"

/**
 * A part's box on the page: its slot (`PartSlot`), or the card inside a
 * slot that draws no box of its own (`display: contents`). None for a
 * part that draws nothing here (add-ons off, a digital product's parcel).
 */
export function partBox(key: PartKey): HTMLElement | null {
  const slot = document.querySelector<HTMLElement>(`[data-part="${key}"]`)
  if (!slot) {
    return null
  }
  const box =
    getComputedStyle(slot).display === "contents"
      ? (slot.firstElementChild as HTMLElement | null)
      : slot
  return box && box.getClientRects().length > 0 ? box : null
}

/** Goes to a part: a folded one opens first (as the advisor's "Alana git"), then the page scrolls. */
export function goToPart(key: PartKey): void {
  const box = partBox(key)
  if (!box) {
    return
  }
  // A slot drawn with its "hidden" line holds the card last
  const card =
    box.dataset["part"] === undefined ? box : (box.lastElementChild as HTMLElement | null)
  // By the card's own id: a folded section opens, a side card in a held column moves only as needed
  if (card?.id) {
    revealSection(card.id)
  } else {
    box.scrollIntoView({ behavior: "smooth", block: "start" })
  }
}

/**
 * The parts of `keys` that draw something now, in their order; asked
 * again whenever the page changes (a card loads, a part is shown).
 */
export function usePresentParts(keys: readonly PartKey[]): PartKey[] {
  const joined = keys.join()
  const [present, setPresent] = useState<PartKey[]>([])
  useEffect(() => {
    const list = joined === "" ? [] : (joined.split(",") as PartKey[])
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const next = list.filter((key) => partBox(key) !== null)
        setPresent((was) => (was.join() === next.join() ? was : next))
      })
    }
    measure()
    const root = document.querySelector("main") ?? document.body
    const watcher = new MutationObserver(measure)
    watcher.observe(root, { childList: true, subtree: true })
    window.addEventListener("resize", measure)
    return () => {
      cancelAnimationFrame(frame)
      watcher.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [joined])
  return present
}

/**
 * The part being read (IntersectionObserver): the first, in page order,
 * whose box crosses the band under the sticky bars (`top` px from the
 * window's top down to 40% of the window). Between two cards the last
 * one read stays marked.
 */
export function useActivePart(keys: readonly PartKey[], top: number): PartKey | null {
  const joined = keys.join()
  const [active, setActive] = useState<PartKey | null>(null)
  useEffect(() => {
    const list = joined === "" ? [] : (joined.split(",") as PartKey[])
    if (list.length === 0 || typeof IntersectionObserver !== "function") {
      return
    }
    const seen = new Set<PartKey>()
    const owner = new Map<Element, PartKey>()
    const watcher = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = owner.get(entry.target)
          if (key) {
            if (entry.isIntersecting) {
              seen.add(key)
            } else {
              seen.delete(key)
            }
          }
        }
        const first = list.find((key) => seen.has(key))
        if (first) {
          setActive(first)
        }
      },
      { rootMargin: `-${String(Math.round(top))}px 0px -60% 0px` }
    )
    for (const key of list) {
      const box = partBox(key)
      if (box) {
        owner.set(box, key)
        watcher.observe(box)
      }
    }
    return () => {
      watcher.disconnect()
    }
  }, [joined, top])
  return active
}
