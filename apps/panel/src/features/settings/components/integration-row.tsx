import { Link } from "@tanstack/react-router"
import { ChevronDown, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import type {
  HealthCheck,
  IntegrationState,
  IntegrationView,
  ProviderFailure,
} from "@/features/settings/api/integrations"
import { settingsLinkOf } from "@/features/settings/integrations"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const I = "settings.integrations"

const TONE: Record<IntegrationState, StatusTone> = {
  connected: "success",
  attention: "warning",
  not_set_up: "neutral",
  off: "neutral",
}

/** A failure in words: the provider's own code where known, else its HTTP status. */
function useFailureText() {
  const { t } = useTranslation()
  return (failure: ProviderFailure) =>
    t(`${I}.failures.codes.${failure.code}`, {
      defaultValue:
        failure.status === null
          ? failure.code
          : t(`${I}.failures.status`, { status: failure.status, code: failure.code }),
    })
}

function FailureList({ failures }: { failures: ProviderFailure[] }) {
  const { t } = useTranslation()
  const describe = useFailureText()
  return (
    <ul className="mt-2 flex flex-col divide-y rounded-md border bg-muted/40 text-[13px]">
      {failures.map((failure) => (
        <li
          key={`${failure.at}-${failure.request_id ?? failure.path}`}
          className="flex flex-col gap-0.5 px-3 py-2"
        >
          <span className="flex flex-wrap gap-x-2">
            <span className="text-muted-foreground tabular-nums">{formatDateTime(failure.at)}</span>
            <span>{describe(failure)}</span>
          </span>
          <span className="font-mono text-[12px] break-all text-muted-foreground">
            {failure.method} {failure.path}
            {failure.request_id ? ` · ${t(`${I}.failures.request`)} ${failure.request_id}` : ""}
          </span>
        </li>
      ))}
    </ul>
  )
}

interface IntegrationRowProps {
  row: IntegrationView
  /** Its live check, when the health report has one. */
  health: HealthCheck | undefined
  onTest: () => void
  testing: boolean
}

/** One outside service (F12.2): what it is, where it stands, its last failed calls. */
export function IntegrationRow({ row, health, onTest, testing }: IntegrationRowProps) {
  const { t } = useTranslation()
  const describe = useFailureText()
  const [open, setOpen] = useState(false)
  const nameId = `integration-${row.id}`
  const link = settingsLinkOf(row.id)
  const [last] = row.failures
  const live = health && health.status !== "not_configured" ? health : undefined
  // What answers now outranks what was stored: a provider down is not "connected"
  const down = live?.status === "down"

  return (
    <li className="flex flex-col gap-2 border-t px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-0.5">
          <span id={nameId} className="text-sm font-medium">
            {t(`${I}.names.${row.id}`, { defaultValue: row.id })}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {t(`${I}.purposes.${row.id}`, { defaultValue: "" })}
          </span>
          {down ? (
            <span className="text-[13px] text-destructive-text">
              {t(`${I}.reasons.${live.reason ?? "error"}`, {
                defaultValue: t(`${I}.reasons.error`),
              })}
            </span>
          ) : null}
          {row.notes.map((note) => (
            <span
              key={note.code}
              className={cn(
                "text-[13px]",
                row.state === "attention" ? "text-warning-text" : "text-muted-foreground"
              )}
            >
              {t(`${I}.notes.${note.code}`, { count: note.count ?? 0, defaultValue: note.code })}
            </span>
          ))}
        </div>
        {/* A phone: the state on its line, the buttons below it sharing the width */}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            {live && !down ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {t(`${I}.latency`, { ms: live.latency_ms })}
              </span>
            ) : null}
            <StatusBadge tone={down ? "danger" : TONE[row.state]}>
              {t(down ? `${I}.states.down` : `${I}.states.${row.state}`)}
            </StatusBadge>
          </div>
          {row.test === "account" || link ? (
            <div className="flex gap-2">
              {row.test === "account" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  disabled={testing}
                  onClick={onTest}
                  aria-describedby={nameId}
                >
                  {testing ? <Loader2 className="animate-spin" /> : null}
                  {t(`${I}.test`)}
                </Button>
              ) : null}
              {link ? (
                <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
                  <Link {...link} aria-describedby={nameId}>
                    {t(`${I}.setUp`)}
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {last ? (
        <div className="text-[13px]">
          <button
            type="button"
            className="flex items-center gap-1.5 text-left text-muted-foreground hover:text-foreground"
            aria-expanded={open}
            onClick={() => {
              setOpen(!open)
            }}
          >
            <ChevronDown
              className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")}
              aria-hidden="true"
            />
            <span>
              {t(`${I}.failures.last`, { when: formatDateTime(last.at), what: describe(last) })}
              {row.failures.length > 1
                ? ` · ${t(`${I}.failures.more`, { count: row.failures.length })}`
                : ""}
            </span>
          </button>
          {open ? <FailureList failures={row.failures} /> : null}
        </div>
      ) : null}
    </li>
  )
}
