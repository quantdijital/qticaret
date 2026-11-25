import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { money } from "@/features/billing/words"
import { packsBody, useSaveSettings } from "@/features/ai-credits/api/mutations"
import type { AiPackSetting, AiSettings } from "@/features/ai-credits/api/schemas"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"
import { PackDialog } from "./pack-dialog"

// The control plane's AI_PACKS_MAX
const PACKS_MAX = 10

type Open =
  { action: "edit"; pack: AiPackSetting | null } | { action: "delete"; pack: AiPackSetting }

/**
 * Yükleme paketleri (adr/0085 K11, K12): what a shop may ask to top up
 * with. Added, edited and deleted one at a time on the packs as they are
 * now, behind a step-up; at most ten.
 */
export function PacksCard({ settings }: { settings: AiSettings }) {
  const { t } = useTranslation()
  const remove = useSaveSettings()
  const [open, setOpen] = useState<Open | null>(null)
  const full = settings.packs.length >= PACKS_MAX
  const columns: Column<AiPackSetting>[] = [
    {
      key: "name",
      header: t("aiCredits.packs.columns.name"),
      cell: (row) => <span className="font-medium break-words">{row.name}</span>,
    },
    {
      key: "credits",
      header: t("aiCredits.packs.columns.credits"),
      align: "right",
      className: "tabular-nums whitespace-nowrap",
      cell: (row) => formatCount(row.credits),
    },
    {
      key: "amount",
      header: t("aiCredits.packs.columns.amount"),
      align: "right",
      className: "tabular-nums whitespace-nowrap",
      cell: (row) => money(row.amount, row.currency),
    },
    {
      key: "active",
      header: t("aiCredits.packs.columns.active"),
      className: "hidden md:table-cell",
      cell: (row) => (
        <StatusBadge tone={row.active ? "success" : "neutral"}>
          {row.active ? t("aiCredits.packs.on") : t("aiCredits.packs.off")}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: t("aiCredits.packs.columns.actions"),
      align: "right",
      cell: (row) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-label={`${t("aiCredits.packs.edit")}: ${row.name}`}
            onClick={() => {
              setOpen({ action: "edit", pack: row })
            }}
          >
            {t("aiCredits.packs.edit")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            aria-label={`${t("aiCredits.packs.delete")}: ${row.name}`}
            onClick={() => {
              setOpen({ action: "delete", pack: row })
            }}
          >
            {t("aiCredits.packs.delete")}
          </Button>
        </div>
      ),
    },
  ]
  const close = () => {
    setOpen(null)
  }
  return (
    <SectionCard
      title={t("aiCredits.packs.title")}
      description={full ? t("aiCredits.packs.max") : t("aiCredits.packs.text")}
      flush
      action={
        <Button
          disabled={full}
          onClick={() => {
            setOpen({ action: "edit", pack: null })
          }}
        >
          {t("aiCredits.packs.add")}
        </Button>
      }
    >
      <DataTable
        columns={columns}
        rows={settings.packs}
        rowKey={(row) => row.id}
        empty={t("aiCredits.packs.empty")}
      />
      {open?.action === "edit" ? <PackDialog pack={open.pack} onClose={close} /> : null}
      {open?.action === "delete" ? (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              close()
            }
          }}
          title={t("aiCredits.packs.deleteDialog.title", { name: open.pack.name })}
          description={t("aiCredits.packs.deleteDialog.text")}
          confirmLabel={t("aiCredits.packs.deleteDialog.confirm")}
          destructive
          onConfirm={() => {
            const id = open.pack.id
            remove.mutate(
              (current) => ({ packs: packsBody(current.packs).filter((each) => each.id !== id) }),
              {
                onSuccess: () => {
                  toast.success(t("aiCredits.packs.deleteDialog.done"))
                },
                onError: (error) => {
                  if (!isStepUpCancelled(error)) {
                    toast.error(errorText(t, error))
                  }
                },
              }
            )
          }}
        />
      ) : null}
    </SectionCard>
  )
}
