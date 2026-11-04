"use client"

import { ArrowRight } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { NavCategoryView } from "@qticaret/ui"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@qticaret/ui/components/navigation-menu"
import { cn } from "@qticaret/ui/lib/utils"

const ITEM =
  "inline-flex h-10 flex-row items-center justify-center gap-1 rounded-button bg-transparent px-4 py-0 text-[13px] font-medium tracking-wide text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground data-[state=open]:bg-foreground/5 data-[state=open]:text-foreground"

/**
 * The category menu on wide screens. A category with children opens a
 * panel on hover or keyboard; the panels are rendered closed in the HTML
 * (`forceMount`), so every category link is there for crawlers without
 * the script (docs/13: internal links in the first HTML).
 */
export function CategoryNav({
  categories,
  label,
  allIn,
}: {
  categories: NavCategoryView[]
  label: string
  /** "Tüm {name}" for each category, already in words. */
  allIn: Record<string, string>
}) {
  return (
    <NavigationMenu viewport={false} aria-label={label} className="max-w-none">
      <NavigationMenuList className="flex-wrap justify-center gap-0.5">
        {categories.map((category, index) =>
          category.children.length === 0 ? (
            <NavigationMenuItem key={category.path}>
              <NavigationMenuLink asChild className={ITEM}>
                <a href={category.path}>{category.label}</a>
              </NavigationMenuLink>
            </NavigationMenuItem>
          ) : (
            <NavigationMenuItem key={category.path}>
              <NavigationMenuTrigger className={ITEM}>{category.label}</NavigationMenuTrigger>
              <NavigationMenuContent
                forceMount
                className={cn(
                  "z-40 rounded-2xl! border-border! bg-card! p-0! shadow-xl! shadow-foreground/5! data-[state=closed]:hidden",
                  // The right half's panels open leftwards, inside the page
                  index >= categories.length / 2 && "right-0 left-auto!"
                )}
              >
                <div className="grid w-[30rem] grid-cols-[1fr_10rem]">
                  <ul className="grid grid-cols-2 content-start gap-x-2 gap-y-0.5 p-3">
                    {category.children.map((child) => (
                      <li key={child.path}>
                        <NavigationMenuLink asChild>
                          <a href={child.path} className="rounded-lg px-3 py-2 text-sm">
                            {child.label}
                          </a>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                  <NavigationMenuLink asChild>
                    <a
                      href={category.path}
                      className="group m-2 flex flex-col justify-between gap-3 rounded-xl bg-muted p-4"
                    >
                      {/* The category's picture when it has one (adr/0046 Ek 2026-11-04); its name says what it is */}
                      {category.image && (
                        <span className="aspect-square overflow-hidden rounded-lg bg-background">
                          <ResponsiveImage
                            image={{ ...category.image, alt: "" }}
                            sizes="128px"
                            className="size-full object-cover"
                          />
                        </span>
                      )}
                      <span className="font-heading text-lg leading-snug">{category.label}</span>
                      <span className="flex items-center gap-1.5 text-xs font-semibold">
                        {allIn[category.path]}
                        <ArrowRight
                          className="size-3.5 transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </span>
                    </a>
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          )
        )}
      </NavigationMenuList>
    </NavigationMenu>
  )
}
