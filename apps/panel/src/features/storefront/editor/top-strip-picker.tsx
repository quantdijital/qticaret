import { PanelTop } from "lucide-react"
import type { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import { MARQUEE_LIMITS } from "@/features/storefront/api/layout"
import { anyPageMarqueesFull } from "@/features/storefront/layout/page-layouts"
import { idsOf, newSectionId } from "@/features/storefront/layout/sections"
import {
  TOP_STRIP_KINDS,
  TOP_STRIP_TYPE,
  newTopStrip,
} from "@/features/storefront/layout/top-strip-kinds"
import type { TopStripKind } from "@/features/storefront/layout/top-strip-kinds"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import { Panel } from "./panel-header"

const S = "storefront.editor.topStrip.pick"

/** Each card's look drawn small, in the current colour (the chooser's sketches' 112 × 32). */
const SKETCHES: Readonly<Record<TopStripKind, () => ReactElement>> = {
  graphite: () => (
    <>
      <rect x={1} y={9} width={110} height={14} rx={2} className="fill-current" />
      <rect x={8} y={14} width={46} height={4} rx={1} className="fill-background" />
      <rect x={80} y={14} width={12} height={4} rx={1} className="fill-background opacity-60" />
      <rect x={96} y={14} width={10} height={4} rx={1} className="fill-background opacity-60" />
    </>
  ),
  light: () => (
    <>
      <rect x={1} y={9} width={110} height={14} rx={2} className="fill-current opacity-15" />
      <rect x={8} y={14} width={40} height={4} rx={1} className="fill-current opacity-70" />
      <rect x={74} y={14} width={14} height={4} rx={1} className="fill-current opacity-50" />
      <rect x={92} y={14} width={14} height={4} rx={1} className="fill-current opacity-50" />
    </>
  ),
  // A wide picture (mountains and sun) with its arrows and dots: the image slider
  slider: () => (
    <>
      <rect x={1} y={4} width={110} height={20} rx={2} className="fill-current opacity-25" />
      <path d="M1 24 L30 11 L48 19 L66 8 L111 24 Z" className="fill-current opacity-60" />
      <circle cx={88} cy={10} r={3} className="fill-current opacity-70" />
      <path d="M8 11 l-3 3 l3 3" className="fill-none stroke-current" strokeWidth={1.5} />
      <path d="M104 11 l3 3 l-3 3" className="fill-none stroke-current" strokeWidth={1.5} />
      <circle cx={52} cy={28.5} r={1.4} className="fill-current" />
      <circle cx={56} cy={28.5} r={1.4} className="fill-current opacity-40" />
      <circle cx={60} cy={28.5} r={1.4} className="fill-current opacity-40" />
    </>
  ),
  marquee: () => (
    <>
      <rect x={1} y={9} width={110} height={14} rx={2} className="fill-current opacity-50" />
      {[4, 30, 56, 82].map((x) => (
        <rect key={x} x={x} y={14} width={20} height={4} rx={1} className="fill-background" />
      ))}
    </>
  ),
}

/**
 * "Üst şeride ekle" as a step of the side panel, as "Bölüm ekle" is for a
 * page: a card for each design with its look drawn small (owner
 * 2026-11-27): the image slider, the dark and the light text strip, the
 * scrolling strip. The header group holds one of each type (adr/0049 §10
 * karar 9): a type already there has its card off saying so (a text
 * strip's other look is changed in its own settings); the scrolling strip
 * also while a page already shows its most scrolling strips.
 */
export function TopStripPicker({
  doc,
  onBack,
  act,
  onAdded,
}: {
  doc: LayoutDocument
  onBack: () => void
  act: (action: EditorAction) => void
  onAdded: (id: string) => void
}) {
  const { t } = useTranslation()
  const has = (type: string) => doc.header.some((section) => section.type === type)
  const why = (kind: TopStripKind): string | null => {
    const type = TOP_STRIP_TYPE[kind]
    if (has(type)) {
      // A text strip there already: its other look is a setting of it, not a second strip
      return t(type === "announcement_bar" ? `${S}.barTaken` : `${S}.taken`)
    }
    return kind === "marquee" && anyPageMarqueesFull(doc)
      ? t("storefront.editor.marquee.full", { max: MARQUEE_LIMITS.perPage })
      : null
  }
  return (
    <Panel icon={PanelTop} title={t(`${S}.title`)} onBack={onBack}>
      <div className="flex flex-col gap-4 px-3 py-4">
        <p className="px-1 text-xs text-muted-foreground">{t(`${S}.description`)}</p>
        <ul className="flex flex-col gap-2">
          {TOP_STRIP_KINDS.map((kind) => {
            const full = why(kind)
            const Sketch = SKETCHES[kind]
            return (
              <li key={kind} className="flex">
                <button
                  type="button"
                  disabled={full !== null}
                  data-add-kind={kind}
                  className="flex h-[4.75rem] w-full items-center gap-3 rounded-md border bg-card p-2 text-left transition-colors focus-visible:outline-none enabled:hover:border-primary/50 enabled:hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60 [html:not([data-input=pointer])_&:focus-visible]:outline-2 [html:not([data-input=pointer])_&:focus-visible]:outline-ring"
                  onClick={() => {
                    const id = newSectionId(idsOf(doc))
                    onAdded(id)
                    act({
                      type: "add",
                      group: "header",
                      section: newTopStrip(kind, id),
                    })
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-full w-24 shrink-0 items-center justify-center rounded-sm bg-muted/70 px-1.5 text-muted-foreground"
                  >
                    <svg viewBox="0 0 112 32" className="size-full h-8 max-w-28">
                      <Sketch />
                    </svg>
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">{t(`${S}.${kind}.name`)}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {full ?? t(`${S}.${kind}.description`)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </Panel>
  )
}
