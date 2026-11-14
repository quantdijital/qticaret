"use client"

import { ChevronDown } from "lucide-react"
import { NavigationMenu } from "radix-ui"
import { useState } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { NavCategoryView } from "@qticaret/ui"

const ITEM =
  "group inline-flex min-h-11 items-center gap-1 rounded-button px-3 text-sm font-semibold whitespace-nowrap text-text-2 transition-colors duration-(--dur-micro) hover:bg-paper-2 hover:text-text data-[state=open]:bg-text data-[state=open]:text-paper"

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
 * its link is followed.
 */
export function Aisle({
  categories,
  label,
  allIn,
}: {
  categories: readonly NavCategoryView[]
  label: string
  /** "Tümünü gör: {name}" for each category path, in words. */
  allIn: Record<string, string>
}) {
  const [open, setOpen] = useState("")
  return (
    <NavigationMenu.Root
      value={open}
      onValueChange={setOpen}
      delayDuration={150}
      aria-label={label}
      className="relative pb-2"
    >
      <NavigationMenu.List className="-ml-3 flex flex-wrap items-center gap-x-1">
        {categories.map((category) =>
          category.children.length === 0 ? (
            <NavigationMenu.Item key={category.path}>
              <NavigationMenu.Link asChild>
                <a href={category.path} className={ITEM}>
                  {category.label}
                </a>
              </NavigationMenu.Link>
            </NavigationMenu.Item>
          ) : (
            <NavigationMenu.Item key={category.path} value={category.path} className="static">
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
                className="absolute top-full -right-3 -left-3 z-(--z-dropdown) rounded-tile border border-rule bg-field p-6 shadow-float data-[state=closed]:hidden xl:p-8"
              >
                <Panel category={category} allIn={allIn[category.path] ?? category.label} />
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          )
        )}
      </NavigationMenu.List>
    </NavigationMenu.Root>
  )
}
