import { PanelTop } from "lucide-react"
import type { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import { MARQUEE_LIMITS } from "@/features/storefront/api/layout"
import { anyPageMarqueesFull } from "@/features/storefront/layout/page-layouts"
import { idsOf, newSectionId } from "@/features/storefront/layout/sections"
import { TOP_STRIP_KINDS, newTopStrip } from "@/features/storefront/layout/top-strip-kinds"
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
  slider: () => (
    <>
      <rect x={1} y={9} width={110} height={14} rx={2} className="fill-current" />
      <path d="M12 13 l-3 3 l3 3" className="fill-none stroke-background" strokeWidth={1.5} />
      <rect x={32} y={14} width={48} height={4} rx={1} className="fill-background" />
      <path d="M100 13 l3 3 l-3 3" className="fill-none stroke-background" strokeWidth={1.5} />
      <circle cx={52} cy={27} r={1.2} className="fill-current" />
      <circle cx={56} cy={27} r={1.2} className="fill-current opacity-40" />
      <circle cx={60} cy={27} r={1.2} className="fill-current opacity-40" />
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
 * page: a card for each kind with its look drawn small. The header group
 * holds one strip and one scrolling strip (adr/0049 §10 karar 9): with a
 * strip already there, its three cards are off and say so (its look is
 * changed in its own settings); the scrolling strip likewise, or while a
 * page already shows its most scrolling strips.
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
  const hasBar = doc.header.some((section) => section.type === "announcement_bar")
  const hasStrip = doc.header.some((section) => section.type === "marquee")
  const why = (kind: TopStripKind): string | null => {
    if (kind !== "marquee") {
      return hasBar ? t(`${S}.barTaken`) : null
    }
    if (hasStrip) {
      return t(`${S}.taken`)
    }
    return anyPageMarqueesFull(doc)
      ? t("storefront.editor.marquee.full", { max: MARQUEE_LIMITS.perPage })
      : null
  }
  const sliderLines = [1, 2, 3].map((n) => t(`${S}.sliderLine${String(n)}`))
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
                      section: newTopStrip(kind, id, sliderLines),
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
