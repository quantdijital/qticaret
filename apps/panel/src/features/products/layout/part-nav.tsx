import { Check } from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import type { PartMark } from "@/features/products/detail/use-product-findings"
import type { PartKey } from "./parts"
import { useActivePart, usePresentParts } from "./use-active-part"

const L = "products.layout.nav"

/** A part's mark: a tick when complete, a dot when something is missing (red when urgent). */
function Mark({ mark }: { mark: PartMark }) {
  const { t } = useTranslation()
  if (mark === null) {
    return null
  }
  return (
    <>
      {mark === "complete" ? (
        <Check className="size-3.5 text-success-text" aria-hidden="true" />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            mark === "urgent" ? "bg-destructive" : "bg-warning"
          )}
        />
      )}
      <span className="sr-only">{t(`${L}.mark.${mark}`)}</span>
    </>
  )
}

/** The bar's own height, kept as the page's scroll padding: a part gone to lands under it. */
function useBarRoom() {
  const bar = useRef<HTMLElement>(null)
  const [top, setTop] = useState(0)
  useLayoutEffect(() => {
    const el = bar.current
    if (!el || typeof ResizeObserver !== "function") {
      return
    }
    const root = document.documentElement
    const measure = () => {
      root.style.scrollPaddingTop = `${String(el.offsetHeight)}px`
      setTop((parseFloat(getComputedStyle(el).top) || 0) + el.offsetHeight)
    }
    measure()
    const watcher = new ResizeObserver(measure)
    watcher.observe(el)
    return () => {
      watcher.disconnect()
      root.style.scrollPaddingTop = ""
    }
  }, [])
  return { bar, top }
}

/**
 * The product page's sections in their order (docs/06 "Ürün sayfası"),
 * held under the top bar: a click goes to one (a folded one opens), the
 * one being read is marked, and each says whether something in it is
 * missing (the advisor's findings, an empty required attribute). Side by
 * side the bar heads the main column and names its parts as chips that
 * wrap; narrower it heads the page and is one picker, so it never scrolls
 * sideways.
 */
export function PartNav({
  parts,
  marks,
  wide,
  onGo,
}: {
  /** The parts laid out and shown, in page order. */
  parts: readonly PartKey[]
  marks: (key: PartKey) => PartMark
  /** The columns stand side by side. */
  wide: boolean
  /** Goes to a part (a folded one opens). */
  onGo: (key: PartKey) => void
}) {
  const { t } = useTranslation()
  const present = usePresentParts(parts)
  const { bar, top } = useBarRoom()
  const seen = useActivePart(present, top)
  const [picked, setPicked] = useState<PartKey | null>(null)
  // A click marks its part at once; the scroll then takes over
  const active = picked ?? seen
  const go = (key: PartKey) => {
    setPicked(key)
    onGo(key)
    window.setTimeout(() => {
      setPicked(null)
    }, 800)
  }
  const name = (key: PartKey) => t(`products.layout.parts.${key}`)
  return (
    <nav
      ref={bar}
      aria-label={t(`${L}.label`)}
      data-part-nav=""
      className="sticky top-[var(--layout-topbar-height)] z-10 -my-2 bg-background py-2"
    >
      {wide ? (
        <ul className="flex flex-wrap gap-1.5">
          {present.map((key) => (
            <li key={key}>
              <button
                type="button"
                aria-current={active === key ? "location" : undefined}
                onClick={() => {
                  go(key)
                }}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border bg-card px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
                  "aria-[current=location]:border-transparent aria-[current=location]:bg-accent aria-[current=location]:font-medium aria-[current=location]:text-accent-foreground"
                )}
              >
                {name(key)} <Mark mark={marks(key)} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Select
          value={active ?? ""}
          onValueChange={(next) => {
            const key = present.find((each) => each === next)
            if (key) {
              go(key)
            }
          }}
        >
          <SelectTrigger className="w-full bg-card" aria-label={t(`${L}.label`)}>
            <SelectValue placeholder={t(`${L}.placeholder`)} />
          </SelectTrigger>
          <SelectContent>
            {present.map((key) => (
              <SelectItem key={key} value={key}>
                <span className="flex items-center gap-2">
                  {name(key)} <Mark mark={marks(key)} />
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </nav>
  )
}
