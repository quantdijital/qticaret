"use client"

import type { NavCategoryView } from "@qticaret/ui"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@qticaret/ui/components/navigation-menu"

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
    <NavigationMenu viewport={false} aria-label={label} className="max-w-none justify-start">
      <NavigationMenuList className="flex-wrap justify-start gap-0">
        {categories.map((category) =>
          category.children.length === 0 ? (
            <NavigationMenuItem key={category.path}>
              <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                <a href={category.path}>{category.label}</a>
              </NavigationMenuLink>
            </NavigationMenuItem>
          ) : (
            <NavigationMenuItem key={category.path}>
              <NavigationMenuTrigger>{category.label}</NavigationMenuTrigger>
              <NavigationMenuContent forceMount className="z-40 data-[state=closed]:hidden">
                <ul className="grid w-[28rem] grid-cols-2 gap-1 p-1">
                  <li className="col-span-2">
                    <NavigationMenuLink asChild>
                      <a href={category.path} className="font-medium">
                        {allIn[category.path]}
                      </a>
                    </NavigationMenuLink>
                  </li>
                  {category.children.map((child) => (
                    <li key={child.path}>
                      <NavigationMenuLink asChild>
                        <a href={child.path}>{child.label}</a>
                      </NavigationMenuLink>
                    </li>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          )
        )}
      </NavigationMenuList>
    </NavigationMenu>
  )
}
