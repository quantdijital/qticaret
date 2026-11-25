import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useCheckKey } from "@/features/ai-credits/api/mutations"
import { providersQuery } from "@/features/ai-credits/api/queries"
import type { AiProvider } from "@/features/ai-credits/api/schemas"
import { capabilityName, serviceName } from "@/features/ai-credits/words"
import { errorText } from "@/lib/errors"
import { DeleteKeyDialog, KeyDialog } from "./key-dialogs"

/** "Bağlantıyı dene" and its verdict, said where a screen reader hears it. */
function CheckButton({ provider, name }: { provider: AiProvider; name: string }) {
  const { t } = useTranslation()
  const check = useCheckKey(provider.service)
  const verdict = check.data
    ? check.data.ok
      ? t("aiCredits.providers.check.ok", { service: name })
      : t(`aiCredits.providers.check.${check.data.reason}`, { service: name })
    : check.isError
      ? errorText(t, check.error)
      : ""
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={check.isPending}
        onClick={() => {
          check.mutate()
        }}
      >
        {check.isPending ? <Loader2 className="animate-spin" /> : null}
        {check.isPending ? t("aiCredits.providers.testing") : t("aiCredits.providers.test")}
      </Button>
      <p
        role="status"
        aria-live="polite"
        className={
          check.data?.ok === true
            ? "text-xs text-success-text"
            : "text-xs text-destructive empty:hidden"
        }
      >
        {verdict}
      </p>
    </div>
  )
}

type Open = { provider: AiProvider; action: "write" | "delete" } | null

/**
 * The platform's provider keys (adr/0085 §2): each service's key held or
 * not, its version and when it was written, what is routed to it. The
 * key itself is never sent to this page. Write, replace, delete (asked
 * first) and "Bağlantıyı dene" for a held one.
 */
export function ProvidersCard() {
  const { t } = useTranslation()
  const providers = useQuery(providersQuery())
  const [open, setOpen] = useState<Open>(null)
  const columns: Column<AiProvider>[] = [
    {
      key: "service",
      header: t("aiCredits.providers.columns.service"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">{serviceName(t, row.service)}</span>
          <span className="text-xs text-muted-foreground">
            {row.has_key && row.version !== null
              ? t("aiCredits.providers.held", { version: row.version })
              : t("aiCredits.providers.none")}
            {row.written_at
              ? ` · ${t("aiCredits.providers.heldOn", { day: formatDate(row.written_at) })}`
              : ""}
          </span>
        </div>
      ),
    },
    {
      key: "routed",
      header: t("aiCredits.providers.columns.routed"),
      className: "hidden md:table-cell",
      cell: (row) =>
        row.routed.length > 0 ? row.routed.map((each) => capabilityName(t, each)).join(", ") : "—",
    },
    {
      key: "actions",
      header: t("aiCredits.providers.columns.actions"),
      align: "right",
      cell: (row) => {
        const name = serviceName(t, row.service)
        return (
          <div className="flex flex-wrap items-start justify-end gap-2">
            <Button
              size="sm"
              variant={row.has_key ? "outline" : "default"}
              onClick={() => {
                setOpen({ provider: row, action: "write" })
              }}
            >
              {row.has_key ? t("aiCredits.providers.replace") : t("aiCredits.providers.write")}
            </Button>
            {row.has_key ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => {
                    setOpen({ provider: row, action: "delete" })
                  }}
                >
                  {t("aiCredits.providers.delete")}
                </Button>
                <CheckButton provider={row} name={name} />
              </>
            ) : null}
          </div>
        )
      },
    },
  ]
  const close = () => {
    setOpen(null)
  }
  return (
    <SectionCard
      title={t("aiCredits.providers.title")}
      description={t("aiCredits.providers.text")}
      flush
    >
      {providers.isError ? (
        <div className="px-5 pb-5">
          <ErrorState
            text={errorText(t, providers.error)}
            onRetry={() => void providers.refetch()}
          />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={providers.data?.providers}
          rowKey={(row) => row.service}
          loading={providers.isPending}
          empty={t("aiCredits.providers.empty")}
        />
      )}
      {open?.action === "write" ? (
        <KeyDialog
          service={open.provider.service}
          name={serviceName(t, open.provider.service)}
          onClose={close}
        />
      ) : null}
      {open?.action === "delete" ? (
        <DeleteKeyDialog
          service={open.provider.service}
          name={serviceName(t, open.provider.service)}
          onClose={close}
        />
      ) : null}
    </SectionCard>
  )
}
