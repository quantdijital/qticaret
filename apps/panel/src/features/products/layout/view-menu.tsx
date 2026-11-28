import { Lock, SlidersHorizontal } from "lucide-react"
import { useId } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@qticaret/admin-ui/ui/popover"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { TAB_KEYS, isLocked } from "./parts"
import type { PartKey, ProductLayout } from "./parts"
import { DEFAULT_VIEW, toggleView, viewOff } from "./view-prefs"
import type { ViewPrefs } from "./view-prefs"

const L = "products.layout"
const V = "products.layout.view"

interface RowProps {
  part: PartKey
  prefs: ViewPrefs
  /** The shop's layout hides it: the person cannot bring it back here. */
  shopHidden: boolean
  unused: boolean
  onPrefs: (next: ViewPrefs) => void
}

function Row({ part, prefs, shopHidden, unused, onPrefs }: RowProps) {
  const { t } = useTranslation()
  const id = useId()
  const name = t(`${L}.parts.${part}`)
  const locked = isLocked(part)
  const on = !shopHidden && !viewOff(prefs, part, unused)
  // A locked part says so by its lock alone: one line each
  const note = locked ? null : shopHidden ? t(`${V}.shopHidden`) : unused ? t(`${V}.unused`) : null
  return (
    <li data-view-row={part} className="flex min-h-9 items-center gap-3 py-1">
      <label htmlFor={id} className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate text-sm", (unused || shopHidden) && "text-muted-foreground")}>
          {name}
        </span>
        {note ? <span className="truncate text-xs text-muted-foreground">{note}</span> : null}
      </label>
      {locked ? (
        <span
          className="flex w-9 justify-center text-muted-foreground"
          role="img"
          aria-label={t(`${L}.locked`)}
          title={t(`${L}.locked`)}
        >
          <Lock className="size-3.5" aria-hidden="true" />
        </span>
      ) : (
        <Switch
          id={id}
          checked={on}
          disabled={shopHidden}
          onCheckedChange={() => {
            onPrefs(toggleView(prefs, part, unused))
          }}
        />
      )}
    </li>
  )
}

/**
 * "Görünüm" beside the page's save (WordPress's "Screen Options"): which of
 * the product page's parts and data tabs this person sees, each a switch,
 * kept for them alone; the shop's layout ("Sayfayı düzenle") stays the
 * team's and what it hides stands. A locked part has no switch; a part
 * this kind of product does not use is greyed and off by default, still
 * turned on here. Only the parts this product draws are listed.
 */
export function ViewMenu({
  layout,
  draws,
  unused,
  simple,
  prefs,
  onPrefs,
}: {
  layout: ProductLayout
  draws: (key: PartKey) => boolean
  unused: (key: PartKey) => boolean
  /** A product without variants: no Varyantlar tab. */
  simple: boolean
  prefs: ViewPrefs
  onPrefs: (next: ViewPrefs) => void
}) {
  const { t } = useTranslation()
  const hidden = new Set<PartKey>(layout.hidden)
  const groups: { title: string; parts: readonly PartKey[] }[] = [
    { title: t(`${L}.main`), parts: layout.main },
    { title: t(`${L}.tabs`), parts: TAB_KEYS.filter((key) => key !== "variants" || !simple) },
    { title: t(`${L}.side`), parts: layout.side },
  ]
  const changed = prefs.hidden.length > 0 || prefs.shown.length > 0
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={t(`${V}.button`)}
          className="px-2.5 sm:px-3"
        >
          <SlidersHorizontal />
          <span className="hidden sm:inline">{t(`${V}.button`)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        className="flex max-h-[min(36rem,var(--radix-popover-content-available-height))] w-[21rem] flex-col p-0"
      >
        <div className="flex flex-col gap-0.5 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t(`${V}.title`)}</h2>
          <p className="text-xs text-muted-foreground">{t(`${V}.description`)}</p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          {groups.map((group) => {
            const parts = group.parts.filter(draws)
            return parts.length === 0 ? null : (
              <section key={group.title} className="flex flex-col">
                <h3 className="text-xs font-semibold text-muted-foreground">{group.title}</h3>
                <ul className="flex flex-col divide-y" aria-label={group.title}>
                  {parts.map((part) => (
                    <Row
                      key={part}
                      part={part}
                      prefs={prefs}
                      shopHidden={hidden.has(part)}
                      unused={unused(part)}
                      onPrefs={onPrefs}
                    />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
        <div className="flex items-center justify-end border-t px-4 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!changed}
            onClick={() => {
              onPrefs(DEFAULT_VIEW)
            }}
          >
            {t(`${V}.reset`)}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
