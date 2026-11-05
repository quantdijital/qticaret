"use client"

import { ChevronDown } from "lucide-react"
import { NavigationMenu } from "radix-ui"
import { useState } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { NavCategoryView } from "@qticaret/ui"

const ITEM =
  "group inline-flex min-h-11 items-center gap-1 rounded-pill px-3 text-sm font-semibold whitespace-nowrap text-text-2 transition-colors duration-(--dur-micro) hover:bg-paper-2 hover:text-text data-[state=open]:bg-paper-2 data-[state=open]:text-text"

/**
 * The category aisle from 1024 px: one line of the shop's top
 * categories; one with children opens a floating panel the container's
 * width, by click or after a 150 ms hover, Escape closing it. Every panel
 * is in the first HTML, closed (`forceMount`), so each link reaches a
 * crawler without a script (docs/13). A closed panel still listens for
 * presses outside it; it lets them pass, or a press inside the open panel
 * would close the menu before its link is followed. The panel: the category's picture
 * when it has one over "Tümünü gör", then its children in three columns
 * of 44 px rows.
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
                className="absolute top-full -right-3 -left-3 z-(--z-dropdown) rounded-tile bg-field p-6 shadow-float data-[state=closed]:hidden"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-(--gap-columns)">
                  <NavigationMenu.Link asChild>
                    <a
                      href={category.path}
                      className="flex flex-col gap-3 self-start rounded-media font-semibold underline-offset-4 hover:underline"
                    >
                      {category.image && (
                        <span className="block aspect-[4/3] overflow-hidden rounded-media bg-paper-2">
                          <ResponsiveImage
                            image={{ ...category.image, alt: "" }}
                            sizes="320px"
                            className="h-full w-full object-cover"
                          />
                        </span>
                      )}
                      {allIn[category.path]}
                    </a>
                  </NavigationMenu.Link>
                  <ul className="columns-3 gap-(--gap-columns)">
                    {category.children.map((child) => (
                      <li key={child.path} className="break-inside-avoid">
                        <NavigationMenu.Link asChild>
                          <a
                            href={child.path}
                            className="flex min-h-11 items-center rounded-inner px-3 text-text-2 hover:bg-paper-2 hover:text-text"
                          >
                            {child.label}
                          </a>
                        </NavigationMenu.Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          )
        )}
      </NavigationMenu.List>
    </NavigationMenu.Root>
  )
}
