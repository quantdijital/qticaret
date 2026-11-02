import { ChevronDown, ChevronUp, TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import { MENU_LOCATIONS, useOrderFooter } from "@/features/storefront/api/menus"
import type { AdminLink, Menu } from "@/features/storefront/api/menus"
import { errorText } from "@/lib/errors"
import { cn } from "@/lib/utils"

const M = "storefront.menus"

const allLinks = (links: readonly AdminLink[]): AdminLink[] =>
  links.flatMap((link) => [link, ...link.children])

interface MenuListCardProps {
  menus: readonly Menu[]
  selectedId: string | null
  onSelect: (id: string) => void
}

/**
 * The shop's menus by where they show: the header's menu, the links above
 * it, the footer's columns in their order. A place with none says what the
 * storefront shows there instead.
 */
export function MenuListCard({ menus, selectedId, onSelect }: MenuListCardProps) {
  const { t } = useTranslation()
  const order = useOrderFooter()
  const columns = menus.filter((menu) => menu.location === "footer")
  const move = (index: number, step: -1 | 1) => {
    const next = [...columns]
    const [column] = next.splice(index, 1)
    if (column) {
      next.splice(index + step, 0, column)
      order.mutate(next, { onError: (error) => toast.error(errorText(t, error)) })
    }
  }

  return (
    <SectionCard title={t(`${M}.list`)} description={t(`${M}.listHint`)} flush>
      <div className="flex flex-col pb-2">
        {MENU_LOCATIONS.map((location) => {
          const here = menus.filter((menu) => menu.location === location)
          const headingId = `menus-${location}`
          return (
            <div key={location} className="flex flex-col border-t">
              <h3
                id={headingId}
                className="px-5 pt-3 pb-1.5 text-xs font-medium tracking-wide text-muted-foreground"
              >
                {t(`${M}.places.${location}`)}
              </h3>
              {here.length === 0 ? (
                <p className="px-5 pb-3 text-[13px] text-muted-foreground">
                  {t(`${M}.fallback.${location}`)}
                </p>
              ) : (
                <ul aria-labelledby={headingId} className="flex flex-col pb-1.5">
                  {here.map((menu, index) => {
                    const links = allLinks(menu.items)
                    const broken = links.filter((link) => link.broken).length
                    const selected = menu.id === selectedId
                    return (
                      <li
                        key={menu.id}
                        className={cn(
                          "flex items-center gap-1 pr-3 transition-colors",
                          selected ? "bg-accent" : "hover:bg-muted/60"
                        )}
                      >
                        <button
                          type="button"
                          aria-current={selected ? "true" : undefined}
                          className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-5 text-left text-sm"
                          onClick={() => {
                            onSelect(menu.id)
                          }}
                        >
                          <span className={cn("truncate", selected && "font-medium")}>
                            {menu.title}
                          </span>
                          {broken > 0 ? (
                            <TriangleAlert
                              className="size-3.5 shrink-0 text-warning-text"
                              aria-label={t(`${M}.brokenCount`, { count: broken })}
                            />
                          ) : null}
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                            {t(`${M}.linkCount`, { count: links.length })}
                          </span>
                        </button>
                        {location === "footer" && here.length > 1 ? (
                          <div className="flex shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={order.isPending || index === 0}
                              aria-label={t(`${M}.columnUp`, { title: menu.title })}
                              onClick={() => {
                                move(index, -1)
                              }}
                            >
                              <ChevronUp />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={order.isPending || index === here.length - 1}
                              aria-label={t(`${M}.columnDown`, { title: menu.title })}
                              onClick={() => {
                                move(index, 1)
                              }}
                            >
                              <ChevronDown />
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}
