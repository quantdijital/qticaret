"use client"

import { Menu } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { LinkView, NavCategoryView } from "@qticaret/ui"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@qticaret/ui/components/accordion"
import { Button } from "@qticaret/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@qticaret/ui/components/sheet"
import { OPEN_MENU_EVENT } from "./menu-events"

export interface MobileMenuWords {
  open: string
  title: string
  close: string
  /** "Tüm {name}" for each category path. */
  allIn: Record<string, string>
}

/**
 * The menu on phones: a drawer with the categories (children folded) and
 * the shop's small links. The same links are in the page's HTML through
 * the wide-screen menu, so the drawer adds nothing a crawler would miss.
 * The bottom bar's "Kategoriler" opens it too, and gets the focus back.
 */
export function MobileMenu({
  categories,
  topLinks,
  words,
}: {
  categories: NavCategoryView[]
  topLinks: LinkView[]
  words: MobileMenuWords
}) {
  const [open, setOpen] = useState(false)
  // Who asked, when not the header's own button: the focus goes back there
  const opener = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const show = (event: Event) => {
      event.preventDefault()
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setOpen(true)
    }
    window.addEventListener(OPEN_MENU_EVENT, show)
    return () => {
      window.removeEventListener(OPEN_MENU_EVENT, show)
    }
  }, [])

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          opener.current = null
        }
      }}
    >
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={words.open}>
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        closeLabel={words.close}
        className="w-[85vw] max-w-sm gap-0"
        onCloseAutoFocus={(event) => {
          if (opener.current) {
            event.preventDefault()
            opener.current.focus()
            opener.current = null
          }
        }}
      >
        <SheetHeader className="border-b">
          <SheetTitle>{words.title}</SheetTitle>
        </SheetHeader>
        <nav aria-label={words.title} className="flex-1 overflow-y-auto px-4 py-2">
          <Accordion type="multiple">
            {categories.map((category) =>
              category.children.length === 0 ? (
                <a
                  key={category.path}
                  href={category.path}
                  className="flex border-b py-4 text-sm font-medium"
                >
                  {category.label}
                </a>
              ) : (
                <AccordionItem key={category.path} value={category.path}>
                  <AccordionTrigger>{category.label}</AccordionTrigger>
                  <AccordionContent>
                    <ul className="flex flex-col gap-3 pl-3">
                      <li>
                        <a href={category.path} className="font-medium">
                          {words.allIn[category.path]}
                        </a>
                      </li>
                      {category.children.map((child) => (
                        <li key={child.path}>
                          <a href={child.path} className="text-muted-foreground">
                            {child.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              )
            )}
          </Accordion>
          {topLinks.length > 0 && (
            <ul className="mt-4 flex flex-col gap-3 py-2 text-sm text-muted-foreground">
              {topLinks.map((link) => (
                <li key={link.path}>
                  <a href={link.path}>{link.label}</a>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
