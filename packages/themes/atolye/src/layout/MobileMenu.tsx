"use client"

import { Menu, MessageCircle, Phone, Plus } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { ContactView, LinkView, NavCategoryView } from "@qticaret/ui"
import { Drawer } from "./Drawer"
import { OPEN_MENU_EVENT } from "./events"

export interface MobileMenuWords {
  open: string
  title: string
  close: string
  /** "Tümünü gör: {name}" for each category path. */
  allIn: Record<string, string>
  whatsapp: string
}

const ROW = "flex min-h-14 items-center gap-3 border-b border-rule px-4 sm:px-6"
const SUB = "flex min-h-11 items-center px-4 text-text-2 sm:px-6"

/**
 * The menu under 1024 px (design.md § Mobile drawer): from the left, the
 * whole phone wide; the top categories as 56 px rows, each with children
 * a native disclosure; then the shop's small links, its phone and
 * WhatsApp. The same links are in the page's HTML through the wide menu,
 * so the drawer hides nothing from a crawler. The bottom bar's
 * "Kategoriler" opens it too, and gets the focus back.
 */
export function MobileMenu({
  categories,
  topLinks,
  contact,
  words,
}: {
  categories: readonly NavCategoryView[]
  topLinks: readonly LinkView[]
  contact: ContactView
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
    <>
      <button
        type="button"
        aria-label={words.open}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          opener.current = null
          setOpen(true)
        }}
        className="at-icon-btn -ml-3 lg:hidden"
      >
        <Menu className="size-6" aria-hidden="true" strokeWidth={1.5} />
      </button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        side="left"
        title={words.title}
        closeLabel={words.close}
        onCloseAutoFocus={(event) => {
          if (opener.current) {
            event.preventDefault()
            opener.current.focus()
            opener.current = null
          }
        }}
      >
        <nav aria-label={words.title} className="flex-1 overflow-y-auto pb-6">
          <ul>
            {categories.map((category) => (
              <li key={category.path}>
                {category.children.length === 0 ? (
                  <a href={category.path} className={`${ROW} at-row-link font-medium`}>
                    {category.label}
                  </a>
                ) : (
                  <details className="group border-b border-rule">
                    <summary
                      className={`${ROW} at-row-link cursor-pointer list-none justify-between border-b-0 font-medium [&::-webkit-details-marker]:hidden`}
                    >
                      {category.label}
                      <Plus
                        className="size-5 shrink-0 group-open:rotate-45 motion-safe:transition-transform"
                        aria-hidden="true"
                        strokeWidth={1.5}
                      />
                    </summary>
                    <ul className="pb-2">
                      <li>
                        <a
                          href={category.path}
                          className={`${SUB} at-row-link font-medium text-text`}
                        >
                          {words.allIn[category.path]}
                        </a>
                      </li>
                      {category.children.map((child) => (
                        <li key={child.path}>
                          <a href={child.path} className={`${SUB} at-row-link`}>
                            {child.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
          {topLinks.length > 0 && (
            <ul className="mt-4 border-t-2 border-rule-ink">
              {topLinks.map((link) => (
                <li key={link.path}>
                  <a href={link.path} className={`${SUB} at-row-link border-b border-rule`}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {(contact.phoneHref ?? contact.whatsappHref) && (
            <ul className="mt-4 flex flex-col gap-2 px-4 sm:px-6">
              {contact.phone && contact.phoneHref && (
                <li>
                  <a href={contact.phoneHref} className="at-btn at-btn--quiet tabular w-full">
                    <Phone className="size-5" aria-hidden="true" strokeWidth={1.5} />
                    {contact.phone}
                  </a>
                </li>
              )}
              {contact.whatsappHref && (
                <li>
                  <a
                    href={contact.whatsappHref}
                    target="_blank"
                    rel="noopener"
                    className="at-btn at-btn--quiet w-full"
                  >
                    <MessageCircle className="size-5" aria-hidden="true" strokeWidth={1.5} />
                    {words.whatsapp}
                  </a>
                </li>
              )}
            </ul>
          )}
        </nav>
      </Drawer>
    </>
  )
}
