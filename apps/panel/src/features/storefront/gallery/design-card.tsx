import { useId } from "react"
import { useTranslation } from "react-i18next"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { DesignCard as Design } from "./api"
import { DesignMenu } from "./design-menu"
import { designName, sourceName } from "./design-name"
import { DesignThumb } from "./design-thumb"
import { LookState } from "./look-state"

const G = "storefront.gallery"

interface DesignCardProps {
  design: Design
  /** No room for another named look: an automatic one cannot be kept by name. */
  savedFull: boolean
  busy: boolean
  onApply: (design: Design, name: string) => void
}

function ApplyButton({ design, name, busy, onApply }: DesignCardProps & { name: string }) {
  const { t } = useTranslation()
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={busy}
      aria-label={t(`${G}.card.applyOf`, { name })}
      onClick={() => {
        onApply(design, name)
      }}
    >
      {t(`${G}.card.apply`)}
    </Button>
  )
}

/**
 * A named saved look (adr/0064), small: its sketch drawn from its own
 * colours and sections, name, date and source in one line, one state;
 * "Taslağa al" brings it into the draft, "⋯" renames or deletes it.
 */
export function DesignCard(props: DesignCardProps) {
  const { design } = props
  const { t } = useTranslation()
  const ids = useId()
  const name = designName(t, design)
  const from = design.summary.source !== "own" ? sourceName(t, design.summary) : null
  return (
    <article
      aria-labelledby={`${ids}-title`}
      className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-2.5 shadow-card"
    >
      <DesignThumb summary={design.summary} />
      <div className="flex items-start gap-1 px-0.5">
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 id={`${ids}-title`} className="truncate text-sm leading-6 font-semibold" title={name}>
            {name}
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            {formatDateTime(design.created_at)}
            {from ? ` · ${t(`${G}.from`, { name: from })}` : null}
          </p>
        </div>
        <DesignMenu design={design} name={name} savedFull={props.savedFull} />
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 px-0.5">
        <LookState live={design.live} inDraft={design.in_draft} edited={design.edited} />
        <ApplyButton {...props} name={name} />
      </div>
    </article>
  )
}

/**
 * An automatic save as one row (adr/0064 Ek 2026-11-17): its name already
 * carries its source and date and time; its size, one state, "Taslağa al"
 * and "⋯" beside it.
 */
export function DesignRow(props: DesignCardProps) {
  const { design } = props
  const { t } = useTranslation()
  const ids = useId()
  const name = designName(t, design)
  return (
    <li
      aria-labelledby={`${ids}-title`}
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5"
    >
      <div className="flex min-w-0 flex-[1_1_14rem] flex-col">
        <span id={`${ids}-title`} className="text-sm leading-6 font-medium break-words">
          {name}
        </span>
        <span className="text-xs text-muted-foreground">
          {t(`${G}.sections`, { count: design.summary.sections.home })}
        </span>
      </div>
      <LookState live={design.live} inDraft={design.in_draft} edited={design.edited} />
      <div className="ml-auto flex items-center gap-1">
        <ApplyButton {...props} name={name} />
        <DesignMenu design={design} name={name} savedFull={props.savedFull} />
      </div>
    </li>
  )
}
