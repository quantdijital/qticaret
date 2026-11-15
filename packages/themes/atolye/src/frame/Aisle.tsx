"use client"

import { ChevronDown } from "lucide-react"
import { NavigationMenu } from "radix-ui"
import { useState } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { NavCategoryView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { useAisleFit } from "./aisle-fit"

const ITEM =
  "gf-aisle-item group inline-flex min-h-11 items-center gap-1 rounded-button px-3 text-sm font-semibold whitespace-nowrap text-text-2 transition-colors duration-(--dur-micro) hover:bg-paper-2 hover:text-text data-[state=open]:bg-text data-[state=open]:text-paper"

/** A category's panel: its children in short columns beside its picture tile. */
function Panel({ category, allIn }: { category: NavCategoryView; allIn: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,18rem)] gap-(--space-xl) xl:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-baseline justify-between gap-6 border-b border-rule pb-4">
          <p className="text-title leading-tight font-extrabold tracking-(--tracking-display)">
            {category.label}
          </p>
          <NavigationMenu.Link asChild>
            <a href={category.path} className="gf-link shrink-0 text-sm">
              {allIn}
            </a>
          </NavigationMenu.Link>
        </div>
        <ul className="columns-3 gap-x-(--gap-columns) xl:columns-4">
          {category.children.map((child) => (
            <li key={child.path} className="break-inside-avoid">
              <NavigationMenu.Link asChild>
                <a
                  href={child.path}
                  className="-mx-3 flex min-h-10 items-center pointer-coarse:min-h-11 rounded-inner px-3 py-2 text-sm leading-snug text-text-2 no-underline hover:bg-paper-2 hover:text-text"
                >
                  {child.label}
                </a>
              </NavigationMenu.Link>
            </li>
          ))}
        </ul>
      </div>
      {category.image && (
        // The same page as the link above, by its picture: one stop for the keyboard
        <a
          href={category.path}
          tabIndex={-1}
          aria-hidden="true"
          className="gf-stage group/tile relative flex aspect-[4/3] flex-col justify-end self-start overflow-hidden rounded-media no-underline after:absolute after:inset-0 after:bg-linear-to-t after:from-stage after:from-5% after:via-stage/0 after:via-55% after:to-transparent"
        >
          <ResponsiveImage
            image={{ ...category.image, alt: "" }}
            sizes="(min-width: 1280px) 336px, 288px"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="relative z-(--z-raised) p-4 text-md font-extrabold underline-offset-4 group-hover/tile:underline">
            {category.label}
          </span>
        </a>
      )}
    </div>
  )
}

/** The categories that did not fit on the bar's line, each with its children under it. */
function MorePanel({ categories }: { categories: readonly NavCategoryView[] }) {
  return (
    <ul className="columns-3 gap-x-(--gap-columns) xl:columns-4">
      {categories.map((category) => (
        <li key={category.path} className="mb-4 break-inside-avoid">
          <NavigationMenu.Link asChild>
            <a
              href={category.path}
              className="-mx-3 flex min-h-10 items-center rounded-inner px-3 py-2 text-sm leading-snug font-bold text-text no-underline pointer-coarse:min-h-11 hover:bg-paper-2"
            >
              {category.label}
            </a>
          </NavigationMenu.Link>
          {category.children.length > 0 && (
            <ul>
              {category.children.map((child) => (
                <li key={child.path}>
                  <NavigationMenu.Link asChild>
                    <a
                      href={child.path}
                      className="-mx-3 flex min-h-10 items-center rounded-inner px-3 py-2 text-sm leading-snug text-text-2 no-underline pointer-coarse:min-h-11 hover:bg-paper-2 hover:text-text"
                    >
                      {child.label}
                    </a>
                  </NavigationMenu.Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}

const PANEL =
  "absolute top-full z-(--z-dropdown) rounded-tile border border-rule bg-field p-6 text-text shadow-float data-[state=closed]:hidden xl:p-8"

/**
 * The category aisle from 1024 px: one line of the shop's top
 * categories; a category with children opens its panel, after a 150 ms
 * hover or by a press, Enter or Space; Escape, a press outside it or
 * leaving it closes it, the focus back on its button (Radix: the button
 * says whether it is open and which panel it opens; the arrow keys move
 * along the line). The panel floats over the page the container's width,
 * so nothing below moves: the category's name and "Tümünü gör" over its
 * children in short columns, its picture tile (the shop's own, else its
 * newest product's photo) beside them. Every panel is in the first HTML,
 * closed (`forceMount`), so each link reaches a crawler without a script
 * (docs/13). A closed panel still listens for presses outside it; it lets
 * them pass, or a press inside the open panel would close the menu before
 * its link is followed. Panels take the page's ink, never the bar's.
 *
 * In the catalog header's menu bar (`inBar`) its panels float under the
 * bar's whole row, the bar's ground on its items, and the line never
 * wraps: the categories that do not fit go under "Daha fazla" (`more`),
 * whose panel lists them with their children (`aisle-fit.ts`).
 */
export function Aisle({
  categories,
  label,
  allIn,
  inBar = false,
  more = "",
}: {
  categories: readonly NavCategoryView[]
  label: string
  /** "Tümünü gör: {name}" for each category path, in words. */
  allIn: Record<string, string>
  /** In the catalog header's menu bar: its panels placed by the bar's row, no line under it. */
  inBar?: boolean
  /** The bar's "Daha fazla", in words. */
  more?: string
}) {
  const [open, setOpen] = useState("")
  const { list, fit } = useAisleFit(categories.length, inBar)
  const shown = fit ?? categories.length
  const rest = categories.slice(shown)
  return (
    <NavigationMenu.Root
      value={open}
      onValueChange={setOpen}
      delayDuration={150}
      aria-label={label}
      className={inBar ? "gf-menubar-aisle static min-w-0 flex-1" : "relative pb-2"}
    >
      <NavigationMenu.List
        ref={list}
        className={
          inBar
            ? "flex flex-nowrap items-center gap-x-1 overflow-x-clip [overflow-clip-margin:0.375rem]"
            : "-ml-3 flex flex-wrap items-center gap-x-1"
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
                <a href={category.path} className={ITEM}>
                  {category.label}
                </a>
              </NavigationMenu.Link>
            </NavigationMenu.Item>
          ) : (
            <NavigationMenu.Item
              key={category.path}
              value={category.path}
              data-aisle-item=""
              className={away ? "static hidden" : "static"}
            >
              <NavigationMenu.Trigger className={ITEM}>
                {category.label}
                <ChevronDown
                  className="size-4 group-data-[state=open]:rotate-180 motion-safe:transition-transform"
                  aria-hidden="true"
                  strokeWidth={2}
                />
              </NavigationMenu.Trigger>
              <NavigationMenu.Content
                forceMount
                onInteractOutside={(event) => {
                  if (open !== category.path) {
                    event.preventDefault()
                  }
                }}
                className={cn(PANEL, inBar ? "inset-x-0" : "-right-3 -left-3")}
              >
                <Panel category={category} allIn={allIn[category.path] ?? category.label} />
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          )
        })}
        {inBar && more !== "" && (fit === null || rest.length > 0) && (
          // Measured while hidden; shown once some categories wait under it
          <NavigationMenu.Item
            value="more"
            data-aisle-more=""
            className={fit === null ? "invisible static" : "static"}
            aria-hidden={fit === null ? true : undefined}
          >
            <NavigationMenu.Trigger className={ITEM} tabIndex={fit === null ? -1 : undefined}>
              {more}
              <ChevronDown
                className="size-4 group-data-[state=open]:rotate-180 motion-safe:transition-transform"
                aria-hidden="true"
                strokeWidth={2}
              />
            </NavigationMenu.Trigger>
            {rest.length > 0 && fit !== null && (
              <NavigationMenu.Content
                onInteractOutside={(event) => {
                  if (open !== "more") {
                    event.preventDefault()
                  }
                }}
                className={cn(PANEL, "inset-x-0")}
              >
                <MorePanel categories={rest} />
              </NavigationMenu.Content>
            )}
          </NavigationMenu.Item>
        )}
      </NavigationMenu.List>
    </NavigationMenu.Root>
  )
}
