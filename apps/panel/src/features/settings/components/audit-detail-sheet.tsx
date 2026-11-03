import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { AuditEntry } from "@/features/settings/api/audit"
import { formatDateTime } from "@/lib/format"
import { describeUserAgent } from "@/lib/user-agent"

const A = "settings.audit.detail"
// A value longer than this is cut in the sheet; the export keeps it whole
const MAX_VALUE = 300

interface FieldChange {
  before?: unknown
  after?: unknown
  changed?: boolean
  after_last4?: string | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)

/** Whether a change set says anything: an empty field list is no detail. */
function hasDetails(changes: Record<string, unknown> | null): changes is Record<string, unknown> {
  if (!changes) {
    return false
  }
  return Object.entries(changes).some(([key, value]) =>
    key === "fields" || key === "diff"
      ? Array.isArray(value) || typeof value === "string"
        ? value.length > 0
        : isRecord(value) && Object.keys(value).length > 0
      : value !== null && value !== undefined && value !== false
  )
}

function shown(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "—"
  }
  const text = typeof value === "string" ? value : JSON.stringify(value)
  return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE)}…` : text
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 py-2 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

/** Field by field: what each was and became; a secret only says it changed. */
function DiffTable({ diff }: { diff: Record<string, unknown> }) {
  const { t } = useTranslation()
  return (
    <table className="w-full table-fixed text-[13px]">
      <thead className="text-left text-xs text-muted-foreground">
        <tr>
          <th className="w-1/4 py-1.5 font-medium">{t(`${A}.field`)}</th>
          <th className="py-1.5 font-medium">{t(`${A}.before`)}</th>
          <th className="py-1.5 font-medium">{t(`${A}.after`)}</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {Object.entries(diff).map(([field, raw]) => {
          const change = (isRecord(raw) ? raw : {}) as FieldChange
          return (
            <tr key={field} className="align-top">
              <td className="py-2 pr-2 font-mono text-[12px] break-words">{field}</td>
              {change.changed ? (
                <td colSpan={2} className="py-2 text-muted-foreground">
                  {change.after_last4
                    ? t(`${A}.secretChangedLast4`, { last4: change.after_last4 })
                    : t(`${A}.secretChanged`)}
                </td>
              ) : (
                <>
                  <td className="py-2 pr-2 break-words text-muted-foreground">
                    {shown(change.before)}
                  </td>
                  <td className="py-2 break-words">{shown(change.after)}</td>
                </>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** What the entry says changed: a field diff, the fields sent, or the action's own details. */
function Changes({ changes }: { changes: Record<string, unknown> }) {
  const { t } = useTranslation()
  const { diff, fields, diff_truncated, diff_total, write_failed, truncated, ...others } = changes
  const sent = Array.isArray(fields) ? fields.filter((field) => typeof field === "string") : []
  // A read keeps the `fields` it asked for as written ("email,*addresses")
  const rest = typeof fields === "string" ? { fields, ...others } : others
  const hasDiff = isRecord(diff) && Object.keys(diff).length > 0
  return (
    <div className="flex flex-col gap-3">
      {hasDiff ? <DiffTable diff={diff} /> : null}
      {diff_truncated === true ? (
        <p className="text-xs text-muted-foreground">
          {t(`${A}.diffCut`, {
            shown: hasDiff ? Object.keys(diff).length : 0,
            total: typeof diff_total === "number" ? diff_total : 0,
          })}
        </p>
      ) : null}
      {!hasDiff && sent.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{t(`${A}.fieldsSent`)}</span>
          <div className="flex flex-wrap gap-1.5">
            {sent.map((field) => (
              <code key={field} className="rounded bg-muted px-1.5 py-0.5 text-[12px]">
                {field}
              </code>
            ))}
          </div>
        </div>
      ) : null}
      {Object.keys(rest).length > 0 ? (
        <dl className="divide-y">
          {Object.entries(rest).map(([key, value]) => (
            <Fact key={key} label={key}>
              <span className="font-mono text-[12px]">{shown(value)}</span>
            </Fact>
          ))}
        </dl>
      ) : null}
      {write_failed === true || truncated === true ? (
        <p className="text-xs text-muted-foreground">
          {t(write_failed === true ? `${A}.writeFailed` : `${A}.tooLarge`)}
        </p>
      ) : null}
    </div>
  )
}

interface AuditDetailSheetProps {
  entry: AuditEntry | null
  /** Who did it, as the table names them. */
  actor: string
  onClose: () => void
}

/**
 * One entry in full (F12.5): who, when, from where, with what outcome, and
 * what changed. Opening it reads nothing new: the list's row holds it all.
 */
export function AuditDetailSheet({ entry, actor, onClose }: AuditDetailSheetProps) {
  const { t } = useTranslation()
  const failed = entry?.outcome !== null && entry?.outcome !== undefined && entry.outcome >= 400
  const browser = entry?.user_agent ? describeUserAgent(entry.user_agent) : null
  return (
    <Sheet
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>{t(`${A}.title`)}</SheetTitle>
          <SheetDescription className="font-mono text-[12px] break-all">
            {entry?.action}
          </SheetDescription>
        </SheetHeader>
        {entry ? (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <dl className="divide-y">
              <Fact label={t("settings.audit.columns.when")}>
                <span className="tabular-nums">{formatDateTime(entry.created_at)}</span>
              </Fact>
              <Fact label={t("settings.audit.columns.kind")}>
                {t(`settings.audit.kinds.${entry.kind}`)}
              </Fact>
              {entry.outcome !== null ? (
                <Fact label={t(`${A}.outcome`)}>
                  <StatusBadge tone={failed ? "danger" : "success"}>
                    {t(failed ? `${A}.failed` : `${A}.succeeded`, { status: entry.outcome })}
                  </StatusBadge>
                </Fact>
              ) : null}
              <Fact label={t("settings.audit.columns.actor")}>
                {actor}
                {entry.actor_id ? (
                  <span className="block font-mono text-[12px] text-muted-foreground">
                    {entry.actor_id}
                  </span>
                ) : null}
              </Fact>
              {entry.resource_type ? (
                <Fact label={t(`${A}.resource`)}>
                  {t(`settings.audit.resources.${entry.resource_type}`, {
                    defaultValue: entry.resource_type,
                  })}
                  {entry.resource_id ? (
                    <span className="block font-mono text-[12px] text-muted-foreground">
                      {entry.resource_id}
                    </span>
                  ) : null}
                </Fact>
              ) : null}
              <Fact label={t(`${A}.requestId`)}>
                <span className="font-mono text-[12px]">{entry.request_id ?? "—"}</span>
              </Fact>
              <Fact label={t("settings.audit.columns.ip")}>
                <span className="font-mono text-[12px]">{entry.ip ?? "—"}</span>
              </Fact>
              <Fact label={t(`${A}.browser`)}>
                {browser ?? (entry.user_agent ? null : "—")}
                {entry.user_agent ? (
                  <span className="block text-xs break-all text-muted-foreground">
                    {entry.user_agent}
                  </span>
                ) : null}
              </Fact>
            </dl>
            <h3 className="mt-5 mb-2 text-sm font-medium">{t(`${A}.heading.${entry.kind}`)}</h3>
            {hasDetails(entry.changes) ? (
              <Changes changes={entry.changes} />
            ) : (
              <p className="text-[13px] text-muted-foreground">{t(`${A}.noChanges`)}</p>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
