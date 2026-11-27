import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { popupQuery, useDeletePopup } from "@/features/popups/api/popups"
import type { PopupDetail } from "@/features/popups/api/types"
import { PopupStateBadge } from "@/features/popups/components/popup-badges"
import { ActiveSwitch } from "@/features/popups/components/active-switch"
import { useCanWritePopups } from "@/features/popups/api/access"
import { PopupsGate } from "@/features/popups/components/popups-gate"
import { PopupForm } from "@/features/popups/editor/popup-form"
import { FactsCard } from "@/features/popups/editor/facts-card"
import { StatsCard } from "@/features/popups/editor/stats-card"
import { errorText } from "@/lib/errors"

const P = "popups"
const route = getRouteApi("/_auth/popups/$id")

/** On or off, and delete: a saved pop-up's own actions. */
function Actions({ popup }: { popup: PopupDetail }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const remove = useDeletePopup()
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <label className="flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium">
        {t(`${P}.columns.active`)}
        <ActiveSwitch popup={popup} disabled={false} />
      </label>
      <Button
        variant="outline"
        size="icon"
        aria-label={t(`${P}.delete`)}
        onClick={() => {
          setConfirm(true)
        }}
      >
        <Trash2 />
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t(`${P}.deleteTitle`, { name: popup.name })}
        description={t(`${P}.deleteDescription`)}
        confirmLabel={t(`${P}.delete`)}
        destructive
        onConfirm={() => {
          remove.mutate(popup, {
            onSuccess: () => {
              toast.success(t(`${P}.deleted`))
              void navigate({ to: "/popups", ignoreBlocker: true })
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
    </>
  )
}

function PopupDetailView({ id }: { id: string }) {
  const { t } = useTranslation()
  const canWrite = useCanWritePopups()
  const query = useQuery(popupQuery(id))
  const back = { to: "/popups", label: t(`${P}.title`) }
  // A failed read again (after a save, say) keeps the page and its form
  if (query.isError && !query.data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t(`${P}.title`)} back={back} />
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      </div>
    )
  }
  if (!query.data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("common.loading")} back={back} />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    )
  }
  const popup = query.data
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={popup.name}
        badge={<PopupStateBadge state={popup.state} />}
        back={back}
        action={canWrite ? <Actions popup={popup} /> : null}
      />
      <PopupForm
        key={popup.id}
        existing={popup}
        canWrite={canWrite}
        aside={
          <>
            <FactsCard popup={popup} />
            <StatsCard popup={popup} />
          </>
        }
      />
    </div>
  )
}

/**
 * One pop-up (adr/0080 S2): the same form as a new one, its preview, facts
 * and counts beside it in the right column.
 */
export function PopupPage() {
  const { t } = useTranslation()
  const { id } = route.useParams()
  return (
    <PopupsGate title={t(`${P}.title`)}>
      <PopupDetailView id={id} />
    </PopupsGate>
  )
}
