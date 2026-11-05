"use client"

import { ChevronDown } from "lucide-react"
import { NavigationMenu } from "radix-ui"
import { ResponsiveImage } from "@qticaret/ui"
import type { NavCategoryView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

const TRIGGER =
  "at-nav-item group inline-flex h-11 items-center gap-1.5 px-3 text-md font-medium whitespace-nowrap"

/**
 * The category menu from 1024 px (design.md § Mega menu): a category with
 * children opens a panel the container's width, by click or after a
 * 150 ms hover, and Escape closes it. Every panel is in the first HTML,
 * closed (`forceMount`), so each category link reaches crawlers without a
 * script (docs/13). The children stand in columns of 44 px rows under an
 * ink rule; "Tümünü gör" leads to the category itself, under the
 * category's picture as a square card when it has one (adr/0046 Ek
 * 2026-11-04); without one no box is drawn.
 */
export function MegaMenu({
  categories,
  label,
  allIn,
}: {
  categories: readonly NavCategoryView[]
  label: string
  /** "Tümünü gör: {name}" for each category path, in words. */
  allIn: Record<string, string>
}) {
  return (
    <NavigationMenu.Root delayDuration={150} aria-label={label} className="relative">
      <NavigationMenu.List className="-ml-3 flex flex-wrap items-center">
        {categories.map((category) =>
          category.children.length === 0 ? (
            <NavigationMenu.Item key={category.path}>
              <NavigationMenu.Link asChild>
                <a href={category.path} className={TRIGGER}>
                  {category.label}
                </a>
              </NavigationMenu.Link>
            </NavigationMenu.Item>
          ) : (
            <NavigationMenu.Item key={category.path} className="static">
              <NavigationMenu.Trigger className={TRIGGER}>
                {category.label}
                <ChevronDown
                  className="size-4 group-data-[state=open]:rotate-180 motion-safe:transition-transform"
                  aria-hidden="true"
                  strokeWidth={1.5}
                />
              </NavigationMenu.Trigger>
              <NavigationMenu.Content
                forceMount
                className="absolute top-full -right-6 -left-6 z-(--z-dropdown) border-t-2 border-rule-ink bg-paper shadow-overlay data-[state=closed]:hidden"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-(--gap-columns) px-6 py-6">
                  <NavigationMenu.Link asChild>
                    <a
                      href={category.path}
                      className={cn(
                        "at-row-link self-start py-2 font-medium",
                        category.image && "flex w-full max-w-60 flex-col gap-3"
                      )}
                    >
                      {category.image && (
                        <span className="block aspect-square overflow-hidden bg-paper-2">
                          <ResponsiveImage
                            // The words under it name the category
                            image={{ ...category.image, alt: "" }}
                            sizes="240px"
                            className="h-full w-full object-cover"
                          />
                        </span>
                      )}
                      {allIn[category.path]}
                    </a>
                  </NavigationMenu.Link>
                  <ul className="columns-3 gap-(--gap-columns)">
                    {category.children.map((child) => (
                      <li key={child.path} className="break-inside-avoid border-b border-rule">
                        <NavigationMenu.Link asChild>
                          <a href={child.path} className="at-row-link flex min-h-11 items-center">
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
