import { useNavigate } from "@tanstack/react-router"
import { Eye, EyeOff, MoreHorizontal, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import { useDeleteLanding, useUpdateLanding } from "@/features/content/api/landings"
import type { LandingDetail } from "@/features/content/api/landings"
import { errorText } from "@/lib/errors"

function PublishButton({ landing }: { landing: LandingDetail }) {
  const { t } = useTranslation()
  const update = useUpdateLanding(landing.id)
  const live = landing.status === "published"
  return (
    <Button
      variant={live ? "outline" : "default"}
      disabled={update.isPending}
      onClick={() => {
        update.mutate(
          { status: live ? "draft" : "published" },
          {
            onSuccess: () => toast.success(t(live ? "content.unpublished" : "content.published")),
            onError: (failure) => toast.error(errorText(t, failure)),
          }
        )
      }}
    >
      {live ? <EyeOff /> : <Eye />}
      {t(live ? "content.unpublish" : "content.publish")}
    </Button>
  )
}

function DeleteMenu({ landing }: { landing: LandingDetail }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const remove = useDeleteLanding()
  const [deleting, setDeleting] = useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={t("common.actions")}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setDeleting(true)
            }}
          >
            <Trash2 />
            {t("content.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("content.deleteTitle", { title: landing.title })}
        description={t(landing.published_at ? "content.deleteLive" : "content.deleteDraft")}
        confirmLabel={t("content.delete")}
        destructive
        onConfirm={() => {
          setDeleting(false)
          remove.mutate(landing.id, {
            onSuccess: () => {
              toast.success(t("content.deleted"))
              void navigate({ to: "/content", search: { kind: "landing" } })
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
    </>
  )
}

/** Publish or take down, and delete. */
export function LandingActions({ landing }: { landing: LandingDetail }) {
  return (
    <div className="flex items-center gap-2">
      <PublishButton landing={landing} />
      <DeleteMenu landing={landing} />
    </div>
  )
}
