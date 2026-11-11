import { Copy } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { usePrepareSigningKey, useRetireSigningKey, useSwitchSigningKey } from "@/features/keys/api"
import type { KeysOverview, SigningKey } from "@/features/keys/api"
import { rotationStep } from "@/features/keys/rotation"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"

const TONES: Record<SigningKey["status"], StatusTone> = {
  active: "success",
  next: "info",
  previous: "warning",
  retired: "neutral",
}

/**
 * The control plane's signing keys (owner): each key's id, status and
 * dates, the next step of a rotation behind one button (each step a
 * step-up; switching and retiring asked first), and the public key list
 * the shops take. No private key is ever here.
 */
export function SigningKeysCard({ overview }: { overview: KeysOverview | undefined }) {
  const { t } = useTranslation()
  const prepare = usePrepareSigningKey()
  const switchKey = useSwitchSigningKey()
  const retire = useRetireSigningKey()
  const [asking, setAsking] = useState<"switch" | "retire" | null>(null)
  const keys = overview?.signing_keys ?? []
  const step = rotationStep(keys)
  const kidOf = (status: SigningKey["status"]) => keys.find((key) => key.status === status)?.kid
  const pending = prepare.isPending || switchKey.isPending || retire.isPending
  const published = overview?.published.env_value ?? ""

  const run = (mutation: { mutate: (input: undefined, options: object) => void }, done: string) => {
    mutation.mutate(undefined, {
      onSuccess: () => toast.success(t(done)),
      onError: (error: unknown) => {
        if (!isStepUpCancelled(error)) {
          toast.error(errorText(t, error))
        }
      },
    })
  }

  const columns: Column<SigningKey>[] = [
    {
      key: "kid",
      header: t("keys.signing.columns.kid"),
      cell: (key) => <span className="font-mono text-[13px]">{key.kid}</span>,
    },
    {
      key: "status",
      header: t("keys.signing.columns.status"),
      cell: (key) => (
        <StatusBadge tone={TONES[key.status]}>{t(`keys.signing.status.${key.status}`)}</StatusBadge>
      ),
    },
    {
      key: "created",
      header: t("keys.signing.columns.created"),
      className: "hidden md:table-cell",
      cell: (key) => formatDate(key.created_at),
    },
    {
      key: "activated",
      header: t("keys.signing.columns.activated"),
      className: "hidden lg:table-cell",
      cell: (key) => (key.activated_at ? formatDate(key.activated_at) : "—"),
    },
  ]

  return (
    <SectionCard
      title={t("keys.signing.title")}
      description={t("keys.signing.text")}
      flush
      action={
        <Button
          variant={step === "retire" ? "destructive" : "default"}
          disabled={!overview || pending}
          onClick={() => {
            if (step === "switch" || step === "retire") {
              setAsking(step)
            } else {
              run(prepare, `keys.signing.steps.${step}.done`)
            }
          }}
        >
          {t(`keys.signing.steps.${step}.action`)}
        </Button>
      }
    >
      <DataTable
        columns={columns}
        rows={overview?.signing_keys}
        rowKey={(key) => key.kid}
        loading={!overview}
        empty={t("keys.signing.empty")}
      />
      <div className="mt-auto flex flex-col gap-3 border-t px-5 py-4">
        <p className="text-[13px] text-muted-foreground">{t(`keys.signing.steps.${step}.text`)}</p>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">{t("keys.signing.published")}</span>
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
            <span
              className={cn(
                "min-w-0 flex-1 text-[13px] break-all",
                published === "" ? "text-muted-foreground" : "font-mono select-all"
              )}
            >
              {published === "" ? t("keys.signing.publishedEmpty") : published}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("keys.signing.copy")}
              disabled={published === ""}
              onClick={() => {
                navigator.clipboard.writeText(published).then(
                  () => toast.success(t("keys.signing.copied")),
                  () => toast.error(t("common.copyFailed"))
                )
              }}
            >
              <Copy />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("keys.signing.publishedText")}</p>
        </div>
      </div>
      <ConfirmDialog
        open={asking === "switch"}
        onOpenChange={(open) => {
          if (!open) setAsking(null)
        }}
        title={t("keys.signing.steps.switch.confirmTitle")}
        description={t("keys.signing.steps.switch.confirmText", { kid: kidOf("next") })}
        confirmLabel={t("keys.signing.steps.switch.action")}
        onConfirm={() => {
          setAsking(null)
          run(switchKey, "keys.signing.steps.switch.done")
        }}
      />
      <ConfirmDialog
        open={asking === "retire"}
        onOpenChange={(open) => {
          if (!open) setAsking(null)
        }}
        title={t("keys.signing.steps.retire.confirmTitle")}
        description={t("keys.signing.steps.retire.confirmText", { kid: kidOf("previous") })}
        confirmLabel={t("keys.signing.steps.retire.action")}
        destructive
        onConfirm={() => {
          setAsking(null)
          run(retire, "keys.signing.steps.retire.done")
        }}
      />
    </SectionCard>
  )
}
