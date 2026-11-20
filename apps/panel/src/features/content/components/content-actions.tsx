import { useNavigate } from "@tanstack/react-router"
import { ExternalLink, Eye, EyeOff, MoreHorizontal, Trash2 } from "lucide-react"
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
import {
  useContentPreview,
  useDeleteContent,
  useUpdateContent,
} from "@/features/content/api/content"
import type { ContentDetail } from "@/features/content/api/content"
import { errorText } from "@/lib/errors"

/** Publish or take down, and delete (with what deleting does to its address). */
export function ContentActions({ entry }: { entry: ContentDetail }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const update = useUpdateContent(entry.id)
  const remove = useDeleteContent()
  const preview = useContentPreview(entry.id)
  const [deleting, setDeleting] = useState(false)
  // The tab opens on the click, before the link exists: a tab opened after
  // the request would be taken for a pop-up
  const openPreview = () => {
    const tab = window.open("about:blank", "_blank")
    preview.mutate(undefined, {
      onSuccess: ({ url }) => {
        if (tab) {
          tab.opener = null
          tab.location.href = url
        }
        void navigator.clipboard.writeText(url).catch(() => undefined)
        toast.success(t("content.previewReady"))
      },
      onError: (failure) => {
        tab?.close()
        toast.error(errorText(t, failure))
      },
    })
  }
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
      <Button variant="outline" disabled={preview.isPending} onClick={openPreview}>
        <ExternalLink />
        {t("content.preview")}
      </Button>
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
                search: {},
              })
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
    </div>
  )
}
