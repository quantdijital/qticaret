"use client"

import { ChevronDown, ChevronRight, LayoutGrid } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react"
import type { NavCategoryView } from "@qticaret/ui"

const LINK =
  "flex min-h-11 items-center gap-2 rounded-inner px-3 text-sm leading-snug text-text-2 no-underline hover:bg-paper-2 hover:text-text"

/** How long the pointer rests on the button before the list opens, and off it before it closes (ms). */
const OPEN_AFTER = 150
const CLOSE_AFTER = 250
/** Up to this many children (and "Tümünü gör") a category's panel is one narrow column. */
const SHORT_LIST = 5

/** The links of the list the focus is in: the top categories', or one category's children. */
function linksBeside(from: HTMLElement): HTMLAnchorElement[] {
  const list = from.closest("[data-cm-list]")
  if (!list) {
    return []
  }
  return [...list.querySelectorAll<HTMLAnchorElement>("a")].filter(
    (link) => link.closest("[data-cm-list]") === list
  )
}

/**
 * The catalog header's "Kategoriler" button (adr/0049 Ek 2026-11-15): the
 * shop's top categories in a column under it; one with children shows
 * them in a panel beside the column while the pointer or the focus is on
 * it. It opens by a press, Enter or Space, or after the pointer rests on
 * it; Escape (from a child, back to its parent first), a press outside it
 * or the focus leaving it closes it. The arrow keys move up and down a
 * column, right into a category's children and left back. Every link is
 * in the first HTML, its panel hidden, so a crawler reaches each without a
 * script (docs/13). Open, it says so (`data-state`), so the sticky header
 * stays unfolded (`frame.css`).
 */
export function CategoryMenu({
  categories,
  words,
}: {
  categories: readonly NavCategoryView[]
  words: { button: string; label: string; allIn: Record<string, string> }
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const id = useId()

  useEffect(() => {
    if (!open) {
      return
    }
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        setOpen(false)
        setActive(-1)
      }
    }
    document.addEventListener("pointerdown", outside)
    return () => {
      document.removeEventListener("pointerdown", outside)
    }
  }, [open])
  useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    []
  )

  const close = (refocus: boolean) => {
    setOpen(false)
    setActive(-1)
    if (refocus) {
      button.current?.focus()
    }
  }
  const later = (event: ReactPointerEvent, then: () => void, after: number) => {
    if (event.pointerType !== "mouse") {
      return
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(then, after)
  }
  // After the state shows the list or a panel, put the focus on its first link
  const focusFirst = (selector: string) => {
    requestAnimationFrame(() => {
      root.current?.querySelector<HTMLAnchorElement>(`${selector} a`)?.focus()
    })
  }

  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const top = target.closest<HTMLElement>("[data-cm-top]")
    const child = target.closest<HTMLElement>("[data-cm-sub]")
    if (event.key === "Escape" && open) {
      event.preventDefault()
      if (child) {
        root.current
          ?.querySelector<HTMLElement>(`[data-cm-top="${child.dataset["cmSub"] ?? ""}"]`)
          ?.focus()
      } else {
        close(true)
      }
      return
    }
    if (target === button.current && event.key === "ArrowDown") {
      event.preventDefault()
      setOpen(true)
      focusFirst("[data-cm-list='top']")
      return
    }
    if (target.tagName !== "A") {
      return
    }
    const links = linksBeside(target)
    const at = links.indexOf(target as HTMLAnchorElement)
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0
    if (step !== 0) {
      event.preventDefault()
      links[(at + step + links.length) % links.length]?.focus()
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault()
      links[event.key === "Home" ? 0 : links.length - 1]?.focus()
    } else if (event.key === "ArrowRight" && top?.dataset["cmTop"] && !child) {
      event.preventDefault()
      setActive(Number(top.dataset["cmTop"]))
      focusFirst(`[data-cm-sub="${top.dataset["cmTop"]}"]`)
    } else if (event.key === "ArrowLeft" && child) {
      event.preventDefault()
      root.current
        ?.querySelector<HTMLElement>(`[data-cm-top="${child.dataset["cmSub"] ?? ""}"]`)
        ?.focus()
    }
  }

  return (
    <div
      ref={root}
      data-state={open ? "open" : "closed"}
      className="relative"
      onKeyDown={keyDown}
      onPointerEnter={(event) => {
        later(
          event,
          () => {
            setOpen(true)
          },
          OPEN_AFTER
        )
      }}
      onPointerLeave={(event) => {
        // Left open by the keyboard or a press while the focus is inside
        later(
          event,
          () => {
            if (!root.current?.contains(document.activeElement)) {
              close(false)
            }
          },
          CLOSE_AFTER
        )
      }}
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node && root.current?.contains(event.relatedTarget))) {
          setOpen(false)
          setActive(-1)
        }
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        className="gf-on-bar group inline-flex min-h-11 items-center gap-2 rounded-button bg-paper-2 px-4 text-sm font-bold whitespace-nowrap text-text transition-colors duration-(--dur-micro) hover:bg-paper-3 aria-expanded:bg-text aria-expanded:text-paper"
        onClick={() => {
          clearTimeout(timer.current)
          setOpen((was) => !was)
          setActive(-1)
        }}
      >
        <LayoutGrid className="size-4" aria-hidden="true" strokeWidth={2} />
        {words.button}
        <ChevronDown
          className="size-4 group-aria-expanded:rotate-180 motion-safe:transition-transform"
          aria-hidden="true"
          strokeWidth={2}
        />
      </button>
      <nav
        id={id}
        aria-label={words.label}
        hidden={!open}
        className="absolute top-full left-0 z-(--z-dropdown) mt-1 w-72 rounded-tile border border-rule bg-field p-2 text-text shadow-float"
      >
        <ul data-cm-list="top" className="flex flex-col">
          {categories.map((category, index) => {
            const own = category.children.length > 0
            const panel = `${id}-${String(index)}`
            // A short list stands in one narrow column, not in a wide empty panel
            const wide = category.children.length > SHORT_LIST
            return (
              <li key={category.path}>
                <a
                  href={category.path}
                  data-cm-top={own ? String(index) : undefined}
                  className={`${LINK} justify-between font-semibold ${active === index ? "bg-paper-2 text-text" : ""}`}
                  {...(own ? { "aria-expanded": active === index, "aria-controls": panel } : {})}
                  onPointerEnter={() => {
                    setActive(own ? index : -1)
                  }}
                  onFocus={() => {
                    setActive(own ? index : -1)
                  }}
                >
                  {category.label}
                  {own && (
                    <ChevronRight className="size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
                  )}
                </a>
                {own && (
                  <div
                    id={panel}
                    data-cm-sub={String(index)}
                    hidden={active !== index}
                    className={`absolute top-0 left-full ml-1 rounded-tile border border-rule bg-field p-5 shadow-float ${wide ? "min-h-full w-[min(34rem,calc(100vw-24rem))]" : "w-64"}`}
                  >
                    <ul
                      data-cm-list={String(index)}
                      className={wide ? "columns-2 gap-x-6" : "flex flex-col"}
                    >
                      {category.children.map((each) => (
                        <li key={each.path} className="break-inside-avoid">
                          <a href={each.path} className={LINK}>
                            {each.label}
                          </a>
                        </li>
                      ))}
                      <li className="break-inside-avoid">
                        <a
                          href={category.path}
                          className={`${LINK} font-semibold text-text underline`}
                        >
                          {words.allIn[category.path] ?? category.label}
                        </a>
                      </li>
                    </ul>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
