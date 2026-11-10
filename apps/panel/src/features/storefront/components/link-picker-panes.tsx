import { useQuery } from "@tanstack/react-query"
import { Check, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SearchInput } from "@/components/patterns/search-input"
import { ErrorState } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import { LEGAL_KINDS, legalOverviewQuery } from "@/features/legal/api"
import { useLinkOptions } from "@/features/storefront/api/link-options"
import { SYSTEM_PAGES } from "@/features/storefront/api/menus"
import type { LinkTarget, RecordKind } from "@/features/storefront/api/menus"
import { errorText } from "@/lib/errors"
import { cn } from "@/lib/utils"

const P = "storefront.menus.picker"

/** What the picker hands back: the target, and what it shows now as far as the panel knows. */
export interface LinkPick {
  to: LinkTarget
  name: string | null
  path: string | null
  broken: boolean
  /** An address comes with its own name. */
  label?: string
}

interface Choice {
  id: string
  name: string
  detail: string | null
  live: boolean
  pick: LinkPick
}

/** Choices as a list of buttons; the one the link points at now is ticked. */
function ChoiceList({
  label,
  choices,
  current,
  onPick,
}: {
  label: string
  choices: readonly Choice[]
  current: string | null
  onPick: (pick: LinkPick) => void
}) {
  const { t } = useTranslation()
  return (
    <ul aria-label={label} className="flex max-h-80 flex-col overflow-y-auto rounded-md border">
      {choices.map((choice) => (
        <li key={choice.id} className="border-t first:border-t-0">
          <button
            type="button"
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
            onClick={() => {
              onPick(choice.pick)
            }}
          >
            <Check
              aria-hidden="true"
              className={cn("size-4 shrink-0", current === choice.id ? "opacity-100" : "opacity-0")}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{choice.name}</span>
              {choice.detail ? (
                <span className="truncate text-xs text-muted-foreground">{choice.detail}</span>
              ) : null}
            </span>
            {choice.live ? null : <StatusBadge tone="warning">{t(`${P}.notLive`)}</StatusBadge>}
          </button>
        </li>
      ))}
    </ul>
  )
}

function Waiting() {
  const { t } = useTranslation()
  return (
    <div aria-busy="true" className="flex justify-center py-8">
      <span className="sr-only">{t("common.loading")}</span>
      <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
    </div>
  )
}

interface PaneProps {
  /** The target the link points at now, to tick it. */
  current: string | null
  onPick: (pick: LinkPick) => void
}

/** Records of one kind, searched by name. */
export function RecordPane({ kind, current, onPick }: PaneProps & { kind: RecordKind }) {
  const { t } = useTranslation()
  const [q, setQ] = useState("")
  const options = useLinkOptions(kind, q)
  const choices = (options.data ?? []).map((option): Choice => ({
    ...option,
    pick: {
      to: { kind, target: option.id },
      name: option.name,
      path: option.path,
      broken: !option.live,
    },
  }))
  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        value={q}
        onChange={setQ}
        placeholder={t(`${P}.search`)}
        className="sm:max-w-none"
      />
      {options.isError ? (
        <ErrorState text={errorText(t, options.error)} onRetry={() => void options.refetch()} />
      ) : options.isPending ? (
        <Waiting />
      ) : choices.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground">
          {t(q ? `${P}.noMatch` : `${P}.none`)}
        </p>
      ) : (
        <ChoiceList
          label={t(`storefront.menus.kinds.${kind}`)}
          choices={choices}
          current={current}
          onPick={onPick}
        />
      )}
    </div>
  )
}

/** The shop's legal texts; one not published is hidden on the storefront until it is. */
export function LegalPane({ current, onPick }: PaneProps) {
  const { t } = useTranslation()
  const overview = useQuery(legalOverviewQuery())
  if (overview.isError) {
    return (
      <ErrorState text={errorText(t, overview.error)} onRetry={() => void overview.refetch()} />
    )
  }
  if (!overview.data) {
    return <Waiting />
  }
  const published = new Map(overview.data.map((row) => [row.kind, row.published]))
  const choices = LEGAL_KINDS.map((kind): Choice => {
    const version = published.get(kind) ?? null
    return {
      id: kind,
      name: t(`settings.legal.kinds.${kind}.name`),
      detail: null,
      live: version !== null,
      pick: {
        to: { kind: "legal", target: kind },
        name: version?.title ?? null,
        path: null,
        broken: version === null,
      },
    }
  })
  return (
    <ChoiceList
      label={t("storefront.menus.kinds.legal")}
      choices={choices}
      current={current}
      onPick={onPick}
    />
  )
}

/** The storefront's own pages, by the storefront's own names. */
export function SystemPane({ current, onPick }: PaneProps) {
  const { t } = useTranslation()
  const choices = SYSTEM_PAGES.map((page): Choice => ({
    id: page,
    name: t(`storefront.menus.system.${page}`),
    detail: null,
    live: true,
    pick: { to: { kind: "system", target: page }, name: null, path: null, broken: false },
  }))
  return (
    <ChoiceList
      label={t("storefront.menus.kinds.system")}
      choices={choices}
      current={current}
      onPick={onPick}
    />
  )
}
