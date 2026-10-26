import { useNavigate } from "@tanstack/react-router"
import { Eye, EyeOff, MoreHorizontal, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDeleteContent, useUpdateContent } from "@/features/content/api/content"
import type { ContentDetail } from "@/features/content/api/content"
import { errorText } from "@/lib/errors"

/** Publish or take down, and delete (with what deleting does to its address). */
export function ContentActions({ entry }: { entry: ContentDetail }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const update = useUpdateContent(entry.id)
  const remove = useDeleteContent()
  const [deleting, setDeleting] = useState(false)
  const live = entry.status === "published"
  const toggle = () => {
    update.mutate(
      { status: live ? "draft" : "published" },
      {
        onSuccess: () => toast.success(t(live ? "content.unpublished" : "content.published")),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  return (
    <div className="flex items-center gap-2">
      <Button variant={live ? "outline" : "default"} disabled={update.isPending} onClick={toggle}>
        {live ? <EyeOff /> : <Eye />}
        {t(live ? "content.unpublish" : "content.publish")}
      </Button>
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
        title={t("content.deleteTitle", { title: entry.title })}
        description={t(entry.published_at ? "content.deleteLive" : "content.deleteDraft")}
        confirmLabel={t("content.delete")}
        destructive
        onConfirm={() => {
          setDeleting(false)
          remove.mutate(entry.id, {
            onSuccess: () => {
              toast.success(t("content.deleted"))
              void navigate({
                to: "/content",
                search: entry.kind === "post" ? { kind: "post" } : {},
              })
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
    </div>
  )
}
