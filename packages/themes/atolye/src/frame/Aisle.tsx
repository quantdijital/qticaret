"use client"

import { ChevronDown } from "lucide-react"
import { NavigationMenu } from "radix-ui"
import { useLayoutEffect, useRef, useState } from "react"
import type { NavCategoryView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import type { MenuWords } from "./menu-words"
import { MenuCount, MenuThumb } from "./MenuParts"

const ITEM =
  "group inline-flex min-h-11 items-center gap-1 rounded-button px-3 text-sm font-semibold whitespace-nowrap text-text-2 transition-colors duration-(--dur-micro) hover:bg-paper-2 hover:text-text data-[state=open]:bg-text data-[state=open]:text-paper"

/**
 * A category's dropdown: its children as 48 px rows (a 40 px picture, the
 * name, the product count in a pill), then "Tümünü gör" with the
 * category's own count in the dark pill. No panel, no big picture.
 */
function Drop({ category, words }: { category: NavCategoryView; words: MenuWords }) {
  return (
    <>
      <ul>
        {category.children.map((child) => (
          <li key={child.path}>
            <NavigationMenu.Link asChild>
              <a href={child.path} className="gf-drop-row">
                <MenuThumb category={child} size={40} />
                <span>{child.label}</span>
                <MenuCount count={words.counts[child.path]} />
              </a>
            </NavigationMenu.Link>
          </li>
        ))}
      </ul>
      <NavigationMenu.Link asChild>
        <a href={category.path} className="gf-drop-row gf-drop-all">
          {/* Heard in full ("Tümünü gör: Çakılar"), its visible words first (WCAG 2.5.3) */}
          <span aria-hidden="true">{words.seeAll}</span>
          <span className="sr-only">{words.allIn[category.path] ?? category.label}</span>
          <MenuCount count={words.counts[category.path]} dark />
        </a>
      </NavigationMenu.Link>
    </>
  )
}

/**
 * The category aisle from 1024 px: one line of the shop's top categories
 * (from the start, or centred under a centred header); a category with
 * children opens its dropdown, after a 150 ms hover or by a press, Enter
 * or Space; Escape, a press outside it or leaving it closes it, the focus
 * back on its button (Radix: the button says whether it is open and which
 * list it opens; the arrow keys move along the line). The dropdown hangs
 * under its own category, 336 px wide, over the page, so nothing below
 * moves; one that would pass the aisle's end lines up with its
 * category's end instead. A category without children is a plain link.
 * Every dropdown is in the first HTML, closed (`forceMount`), so each
 * link reaches a crawler without a script (docs/13). A closed dropdown
 * still listens for presses outside it; it lets them pass, or a press
 * inside the open one would close the menu before its link is followed.
 */
export function Aisle({
  categories,
  label,
  words,
  centered = false,
}: {
  categories: readonly NavCategoryView[]
  label: string
  words: MenuWords
  /** The centred header's aisle: the line centred. */
  centered?: boolean
}) {
  const [open, setOpen] = useState("")
  const root = useRef<HTMLElement>(null)

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

  return (
    <NavigationMenu.Root
      ref={root}
      value={open}
      onValueChange={setOpen}
      delayDuration={150}
      aria-label={label}
      className="relative pb-2"
    >
      <NavigationMenu.List
        className={cn("flex flex-wrap items-center gap-x-1", centered ? "justify-center" : "-ml-3")}
      >
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
            <NavigationMenu.Item key={category.path} value={category.path} className="relative">
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
                data-gf-drop={category.path}
                onInteractOutside={(event) => {
                  if (open !== category.path) {
                    event.preventDefault()
                  }
                }}
                className="gf-drop data-[state=closed]:hidden"
              >
                <Drop category={category} words={words} />
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          )
        )}
      </NavigationMenu.List>
    </NavigationMenu.Root>
  )
}
