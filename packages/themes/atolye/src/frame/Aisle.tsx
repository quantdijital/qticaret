"use client"

import { ChevronDown } from "lucide-react"
import { NavigationMenu } from "radix-ui"
import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import type { LinkView, NavCategoryView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { useAisleFit } from "./aisle-fit"
import { Drop, Word } from "./AisleDrop"
import { BarLinks, MORE_PANEL, MorePanel } from "./AisleMore"
import type { MenuWords } from "./menu-words"

/** An aisle item; its hovered and open look is the menus' one recipe (`menu.css`, `menu_style`). */
const ITEM =
  "gf-menu-item group inline-flex min-h-11 items-center gap-1 rounded-button px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-(--dur-micro)"
/**
 * In the menu bar (Tezgâh audits Y-05, Y-06): 8 px in below 1280 px, so one
 * more category fits; open, the bar's own raised tone and a line under it
 * (`.gf-menu-item--bar`), never the filled box the highlighted link beside
 * it is drawn as.
 */
const BAR_ITEM = "gf-menu-item--bar px-2 xl:px-3"

/**
 * The category aisle from 1024 px: one line of the shop's top categories
 * (from the start, or centred under a centred header); a category with
 * children opens its dropdown (`AisleDrop`), after a 150 ms hover or by a
 * press, Enter or Space; Escape, a press outside it or leaving it closes
 * it, the focus back on its button (Radix: the button says whether it is
 * open and which list it opens; the arrow keys move along the line). The
 * dropdown hangs under its own category, 336 px wide, over the page, so
 * nothing below moves; one that would pass the aisle's end lines up with
 * its category's end instead. A category without children is a plain
 * link. Every dropdown is in the first HTML, closed (`forceMount`), so
 * each link reaches a crawler without a script (docs/13). A closed
 * dropdown still listens for presses outside it; it lets them pass, or a
 * press inside the open one would close the menu before its link is
 * followed. Dropdowns take the page's ink, never the bar's.
 *
 * In the catalog header's menu bar (`inBar`) the bar's ground is on its
 * items, and the line never wraps: the categories that do not fit go
 * under "Daha fazla" (`more`), whose panel lists them with their children
 * (`aisle-fit.ts`); each category on the line opens the same dropdown.
 * The shop's top links (`links`, `top_links: bar`) stand quietly at the
 * bar's end while every category fits beside them, else they go under
 * "Daha fazla" too.
 */
export function Aisle({
  categories,
  label,
  words,
  centered = false,
  inBar = false,
  more = "",
  tail,
  pictures = true,
  links = [],
  linksLabel = "",
  inRow = false,
  current = null,
}: {
  categories: readonly NavCategoryView[]
  label: string
  words: MenuWords
  /** The centred header's aisle: the line centred. */
  centered?: boolean
  /** In the catalog header's menu bar: the bar's ground on its items, no line under it. */
  inBar?: boolean
  /** The bar's "Daha fazla", in words. */
  more?: string
  /** In the bar, an item always shown right after the last category (the highlighted link). */
  tail?: ReactNode
  /** The dropdowns' small pictures (`HeaderBarView.menuImages` not `off`); else words only. */
  pictures?: boolean
  /** In the bar, the shop's top links at its end (under "Daha fazla" when they do not fit). */
  links?: readonly LinkView[]
  /** The links' group's name for a screen reader. */
  linksLabel?: string
  /** In the one-row header's own row (`inline`): no room kept under the line. */
  inRow?: boolean
  /** The page's own path: its plain link is marked `aria-current="page"`; null: none. */
  current?: string | null
}) {
  const [open, setOpen] = useState("")
  const root = useRef<HTMLElement>(null)
  const barLinks = inBar ? links : []
  const {
    list,
    links: linksGroup,
    fit,
  } = useAisleFit(`${String(categories.length)}:${String(barLinks.length)}`, inBar)
  const shown = fit?.count ?? categories.length
  const rest = categories.slice(shown)
  const linksAway = barLinks.length > 0 && fit !== null && !fit.links

  // Measured as it opens, before it is painted: past the aisle's end, it lines up at its end
  useLayoutEffect(() => {
    const drop = [...(root.current?.querySelectorAll<HTMLElement>("[data-gf-drop]") ?? [])].find(
      (each) => open !== "" && each.getAttribute("data-gf-drop") === open
    )
    const bounds = root.current?.getBoundingClientRect()
    const item = drop?.parentElement?.getBoundingClientRect()
    if (drop && bounds && item) {
      drop.setAttribute("data-align", item.left + drop.offsetWidth > bounds.right ? "end" : "start")
    }
  }, [open])

  const menu = (
    <NavigationMenu.Root
      ref={root}
      value={open}
      onValueChange={setOpen}
      delayDuration={150}
      aria-label={label}
      className={
        inBar ? "gf-menubar-aisle static min-w-0 flex-1" : inRow ? "relative" : "relative pb-2"
      }
    >
      <NavigationMenu.List
        ref={list}
        className={
          inBar
            ? cn(
                "flex flex-nowrap items-center gap-x-1",
                // Clipped only while measured: the "Daha fazla" panel opens leftward from its button
                fit === null && "overflow-x-clip [overflow-clip-margin:0.375rem]"
              )
            : cn("flex flex-wrap items-center gap-x-1", centered ? "justify-center" : "-ml-3")
        }
      >
        {categories.map((category, index) => {
          const away = inBar && index >= shown
          return category.children.length === 0 ? (
            <NavigationMenu.Item
              key={category.path}
              data-aisle-item=""
              className={away ? "hidden" : undefined}
            >
              <NavigationMenu.Link asChild>
                <a
                  href={category.path}
                  aria-current={current !== null && category.path === current ? "page" : undefined}
                  className={cn(ITEM, inBar && BAR_ITEM)}
                >
                  <Word text={category.label} />
                </a>
              </NavigationMenu.Link>
            </NavigationMenu.Item>
          ) : (
            <NavigationMenu.Item
              key={category.path}
              value={category.path}
              data-aisle-item=""
              className={cn("relative", away && "hidden")}
            >
              <NavigationMenu.Trigger className={cn(ITEM, inBar && BAR_ITEM)}>
                <Word text={category.label} />
                <ChevronDown
                  className="size-4 group-data-[state=open]:rotate-180 motion-safe:transition-transform"
                  aria-hidden="true"
                  strokeWidth={2}
                />
              </NavigationMenu.Trigger>
              <NavigationMenu.Content
                forceMount
                data-gf-drop={category.path}
                onInteractOutside={(event) => {
                  if (open !== category.path) {
                    event.preventDefault()
                  }
                }}
                className="gf-drop data-[state=closed]:hidden"
              >
                <Drop category={category} words={words} pictures={pictures} />
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          )
        })}
        {inBar && more !== "" && (fit === null || rest.length > 0 || linksAway) && (
          // Measured while hidden; shown once some categories (or the links) wait under it
          <NavigationMenu.Item
            value="more"
            data-aisle-more=""
            className={fit === null ? "invisible relative" : "relative"}
            aria-hidden={fit === null ? true : undefined}
          >
            <NavigationMenu.Trigger
              className={cn(ITEM, BAR_ITEM)}
              tabIndex={fit === null ? -1 : undefined}
            >
              <Word text={more} />
              <ChevronDown
                className="size-4 group-data-[state=open]:rotate-180 motion-safe:transition-transform"
                aria-hidden="true"
                strokeWidth={2}
              />
            </NavigationMenu.Trigger>
            {(rest.length > 0 || linksAway) && fit !== null && (
              <NavigationMenu.Content
                onInteractOutside={(event) => {
                  if (open !== "more") {
                    event.preventDefault()
                  }
                }}
                className={MORE_PANEL}
              >
                <MorePanel categories={rest} links={linksAway ? barLinks : []} />
              </NavigationMenu.Content>
            )}
          </NavigationMenu.Item>
        )}
        {inBar && tail && (
          <li data-aisle-tail="" className="flex shrink-0 items-center">
            {tail}
          </li>
        )}
      </NavigationMenu.List>
    </NavigationMenu.Root>
  )
  if (barLinks.length === 0) {
    return menu
  }
  return (
    <>
      {menu}
      <BarLinks ref={linksGroup} links={barLinks} label={linksLabel} hidden={linksAway} />
    </>
  )
}
