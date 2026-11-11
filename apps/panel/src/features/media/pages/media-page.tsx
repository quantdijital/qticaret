import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { Upload } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { SearchInput } from "@qticaret/admin-ui/patterns/search-input"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { useRecordWalk } from "@qticaret/admin-ui/hooks/use-record-walk"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { useCan } from "@/features/auth/api/staff"
import { MEDIA_PAGE_SIZE, mediaListQuery } from "@/features/media/api/media"
import { MediaDetailDialog } from "@/features/media/components/media-detail-dialog"
import { MediaGrid } from "@/features/media/components/media-grid"
import { UploadZone } from "@/features/media/components/upload-zone"
import { LimitNotice } from "@/features/settings/components/limit-notice"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/media")

/** Files from this computer into the library; closes once every one is in. */
function UploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{t("media.upload.title")}</DialogTitle>
            <DialogDescription>{t("media.upload.description")}</DialogDescription>
          </DialogHeader>
          <DialogBody list>
            <UploadZone
              onUploaded={(assets, failed) => {
                toast.success(t("media.upload.done", { count: assets.length }))
                if (failed === 0) {
                  onOpenChange(false)
                }
              }}
            />
          </DialogBody>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

/**
 * The media library (docs/06 Ortam kütüphanesi): every picture the shop
 * uploaded or brought in from an address, newest first, searchable; one
 * opens in a dialog with its words, its address and where it is used.
 */
export function MediaPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const canUpload = useCan("catalog")
  const q = search.q ?? ""
  const page = (search.page ?? 1) - 1
  const list = useQuery(mediaListQuery({ q, page }))
  const [uploading, setUploading] = useState(false)
  const walk = useRecordWalk(list.data?.media, (asset) => asset.id)
  const setSearch = (next: { q?: string; page?: number }) => {
    void navigate({
      to: "/media",
      search: (previous: { q?: string | undefined; page?: number | undefined }) => {
        const merged = { ...previous, ...next }
        return {
          q: merged.q === "" ? undefined : merged.q,
          page: merged.page && merged.page > 1 ? merged.page : undefined,
        }
      },
      replace: true,
    })
  }
  const upload = canUpload ? (
    <Button
      onClick={() => {
        setUploading(true)
      }}
    >
      <Upload />
      {t("media.uploadAction")}
    </Button>
  ) : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("nav.media")} description={t("media.description")} action={upload} />
      {/* adr/0061 Ek C14: near or at the package's storage limit */}
      <LimitNotice limit="storage_mb" />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
          <SearchInput
            value={q}
            placeholder={t("media.search")}
            onChange={(text) => {
              setSearch({ q: text, page: 1 })
            }}
          />
        </div>
        <div className="p-5">
          {list.isError ? (
            <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
          ) : (
            <MediaGrid
              items={list.data?.media}
              loading={list.isPending}
              stale={list.isPlaceholderData}
              onItemClick={walk.show}
              empty={
                <div className="flex flex-col items-center gap-3 text-center">
                  <p className="max-w-sm text-sm text-muted-foreground">
                    {t(q ? "media.noMatch" : "media.empty")}
                  </p>
                  {q ? null : upload}
                </div>
              }
            />
          )}
        </div>
        {list.data && list.data.count > MEDIA_PAGE_SIZE ? (
          <Pagination
            page={page}
            pageSize={MEDIA_PAGE_SIZE}
            count={list.data.count}
            onPageChange={(next) => {
              setSearch({ page: next + 1 })
            }}
          />
        ) : null}
      </section>
      <UploadDialog open={uploading} onOpenChange={setUploading} />
      <MediaDetailDialog id={walk.open?.id ?? null} steps={walk.steps} onClose={walk.close} />
    </div>
  )
}
