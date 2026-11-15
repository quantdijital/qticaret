import { ChevronDown } from "lucide-react"
import type { OutlineItemView, Translate } from "@qticaret/ui"

/** How many headings make a text long enough for a table of contents. */
export const OUTLINE_MIN = 3

/** Whether the text gets a table of contents. */
export const hasOutline = (outline: readonly OutlineItemView[] | undefined): boolean =>
  (outline?.length ?? 0) >= OUTLINE_MIN

function Links({
  outline,
  linkClass,
  itemClass,
}: {
  outline: readonly OutlineItemView[]
  linkClass: string
  itemClass?: string
}) {
  return (
    <ol className="flex flex-col">
      {outline.map((item) => (
        <li key={item.id} className={itemClass}>
          <a href={`#${item.id}`} className={linkClass}>
            {item.label}
          </a>
        </li>
      ))}
    </ol>
  )
}

/** On a phone: the contents as a closed well above the text ("İçindekiler · N bölüm"). */
export function OutlineWell({
  outline,
  t,
  className,
}: {
  outline: readonly OutlineItemView[]
  t: Translate
  className?: string
}) {
  return (
    <details className={`group rounded-tile gf-pane lg:hidden ${className ?? ""}`}>
      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-4 px-5 font-semibold">
        <span>{t("legal.contents")}</span>
        <span className="flex items-center gap-2 text-sm font-normal text-text-3">
          {t("legal.sections", { count: outline.length })}
          <ChevronDown
            className="size-5 group-open:rotate-180 motion-safe:transition-transform motion-safe:duration-(--dur-short)"
            aria-hidden="true"
            strokeWidth={1.75}
          />
        </span>
      </summary>
      <div className="px-2 pb-3">
        <Links
          outline={outline}
          linkClass="flex min-h-11 items-center rounded-inner px-3 py-2 text-sm text-text-2 no-underline hover:bg-paper-3 hover:text-text"
        />
      </div>
    </details>
  )
}

/** From 1024 px: the contents beside the text, staying in view while it scrolls. */
export function OutlineAside({
  id,
  outline,
  t,
  className,
}: {
  id: string
  outline: readonly OutlineItemView[]
  t: Translate
  className?: string
}) {
  return (
    <aside aria-labelledby={id} className={`max-lg:hidden ${className ?? ""}`}>
      <div className="sticky top-(--gf-stick-top) flex max-h-[calc(100dvh-var(--gf-stick-top)-1rem)] max-w-64 flex-col gap-3 overflow-y-auto pb-4">
        <h2 id={id} className="text-md tracking-normal text-text">
          {t("legal.contents")}
        </h2>
        <Links
          outline={outline}
          itemClass="py-1.5 text-sm leading-snug"
          linkClass="text-text-2 no-underline underline-offset-4 hover:text-text hover:underline"
        />
      </div>
    </aside>
  )
}
