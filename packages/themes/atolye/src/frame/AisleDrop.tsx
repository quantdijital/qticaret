import { NavigationMenu } from "radix-ui"
import type { NavCategoryView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import type { MenuWords } from "./menu-words"
import { MenuCount, MenuThumb } from "./MenuParts"

/**
 * A category's dropdown (the owner's "M1", 2026-11-15; `menu.css`): its
 * children as 48 px rows (a 40 px picture, the name, the product count in
 * a pill), then "Tümünü gör" with the category's own count in the dark
 * pill. No panel, no big picture. With the shop's pictures off (adr/0049
 * Ek 2026-11-15) the rows are the name and the count, 44 px, no square.
 */
export function Drop({
  category,
  words,
  pictures = true,
}: {
  category: NavCategoryView
  words: MenuWords
  pictures?: boolean
}) {
  const row = cn("gf-drop-row", !pictures && "gf-drop-row--words")
  return (
    <>
      <ul>
        {category.children.map((child) => (
          <li key={child.path}>
            <NavigationMenu.Link asChild>
              <a href={child.path} className={row}>
                {pictures && <MenuThumb category={child} size={40} />}
                <span>{child.label}</span>
                <MenuCount count={words.counts[child.path]} />
              </a>
            </NavigationMenu.Link>
          </li>
        ))}
      </ul>
      <NavigationMenu.Link asChild>
        <a href={category.path} className={cn(row, "gf-drop-all")}>
          {/* Heard in full ("Tümünü gör: Çakılar"), its visible words first (WCAG 2.5.3) */}
          <span aria-hidden="true">{words.seeAll}</span>
          <span className="sr-only">{words.allIn[category.path] ?? category.label}</span>
          <MenuCount count={words.counts[category.path]} dark />
        </a>
      </NavigationMenu.Link>
    </>
  )
}
