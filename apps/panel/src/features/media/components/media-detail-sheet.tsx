import { useQuery } from "@tanstack/react-query"
import { Copy } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { Field } from "@/components/patterns/form-section"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useCan } from "@/features/auth/api/staff"
import {
  mediaDetailQuery,
  mediaFacts,
  useDeleteMedia,
  useUpdateMedia,
} from "@/features/media/api/media"
import type { MediaDetail } from "@/features/media/api/media"
import { MediaUsage } from "@/features/media/components/media-usage"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@/lib/format"

const D = "media.detail"
// The server's limits (alt text docs/13 §8; the library's names)
const ALT_MAX = 250
const NAME_MAX = 200

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-center gap-3 py-2 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 break-words">{children}</dd>
    </div>
  )
}

/** The name the library shows and the alt text; saved together, only while changed. */
function Words({ media, canEdit }: { media: MediaDetail; canEdit: boolean }) {
  const { t } = useTranslation()
  const update = useUpdateMedia(media.id)
  const [filename, setFilename] = useState(media.filename)
  const [alt, setAlt] = useState(media.alt ?? "")
  const dirty = filename.trim() !== media.filename || alt.trim() !== (media.alt ?? "")
  const save = () => {
    update.mutate(
      { filename: filename.trim(), alt: alt.trim() || null },
      {
        onSuccess: () => toast.success(t(`${D}.saved`)),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <Field label={t(`${D}.filename`)} htmlFor="media-filename" hint={t(`${D}.filenameHint`)}>
        <Input
          id="media-filename"
          value={filename}
          maxLength={NAME_MAX}
          disabled={!canEdit}
          onChange={(event) => {
            setFilename(event.target.value)
          }}
        />
      </Field>
      <Field label={t(`${D}.alt`)} htmlFor="media-alt" hint={t(`${D}.altHint`)}>
        <Input
          id="media-alt"
          value={alt}
          maxLength={ALT_MAX}
          disabled={!canEdit}
          onChange={(event) => {
            setAlt(event.target.value)
          }}
        />
      </Field>
      {canEdit && dirty ? (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilename(media.filename)
              setAlt(media.alt ?? "")
            }}
          >
            {t("common.reset")}
          </Button>
          <Button type="submit" size="sm" disabled={filename.trim() === "" || update.isPending}>
            {t("common.save")}
          </Button>
        </div>
      ) : null}
    </form>
  )
}

function Detail({ media, onClose }: { media: MediaDetail; onClose: () => void }) {
  const { t } = useTranslation()
  const canEdit = useCan("catalog")
  const remove = useDeleteMedia()
  const [confirming, setConfirming] = useState(false)
  const used = media.usage.length > 0
  const copy = () => {
    navigator.clipboard.writeText(media.url).then(
      () => toast.success(t(`${D}.copied`)),
      () => toast.error(t(`${D}.copyFailed`))
    )
  }
  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle className="truncate">{media.filename}</SheetTitle>
        <SheetDescription className="tabular-nums">{mediaFacts(media)}</SheetDescription>
      </SheetHeader>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
        <div className="flex h-64 items-center justify-center overflow-hidden rounded-md border bg-muted">
          <img
            src={media.url}
            alt={media.alt ?? ""}
            className="max-h-full max-w-full object-contain"
          />
        </div>
        <Words key={`${media.filename}|${media.alt ?? ""}`} media={media} canEdit={canEdit} />
        <dl className="divide-y">
          <Fact label={t(`${D}.uploadedBy`)}>{media.uploaded_by?.name ?? "—"}</Fact>
          <Fact label={t(`${D}.uploadedAt`)}>{formatDateTime(media.created_at)}</Fact>
          <Fact label={t(`${D}.address`)}>
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{media.url}</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              aria-label={t(`${D}.copy`)}
              onClick={copy}
            >
              <Copy />
            </Button>
          </Fact>
        </dl>
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">{t(`${D}.usage`)}</h3>
          <MediaUsage usage={media.usage} />
        </section>
      </div>
      {canEdit ? (
        <SheetFooter className="flex-row items-center justify-between gap-3 border-t">
          <p className="text-xs text-muted-foreground">{used ? t(`${D}.inUse`) : null}</p>
          <Button
            variant="outline"
            className="text-destructive-text"
            disabled={used || remove.isPending}
            onClick={() => {
              setConfirming(true)
            }}
          >
            {t(`${D}.delete`)}
          </Button>
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={t(`${D}.deleteTitle`)}
            description={t(`${D}.deleteDescription`, { name: media.filename })}
            confirmLabel={t(`${D}.deleteConfirm`)}
            destructive
            onConfirm={() => {
              remove.mutate(media.id, {
                onSuccess: () => {
                  toast.success(t(`${D}.deleted`))
                  onClose()
                },
                onError: (failure) => toast.error(errorText(t, failure)),
              })
            }}
          />
        </SheetFooter>
      ) : null}
    </>
  )
}

function Loaded({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation()
  const detail = useQuery(mediaDetailQuery(id))
  if (detail.data) {
    return <Detail media={detail.data} onClose={onClose} />
  }
  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>{t(`${D}.title`)}</SheetTitle>
        <SheetDescription className="sr-only">{t(`${D}.title`)}</SheetDescription>
      </SheetHeader>
      <div className="px-6 py-6">
        {detail.isError ? (
          <ErrorState text={errorText(t, detail.error)} onRetry={() => void detail.refetch()} />
        ) : (
          <LoadingRows rows={5} />
        )}
      </div>
    </>
  )
}

/**
 * One library image beside the grid: the picture, its name and alt text,
 * who uploaded it, its address to copy, where the shop shows it, and
 * deleting it while nothing does.
 */
export function MediaDetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Sheet
      open={id !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
        {id ? <Loaded id={id} onClose={onClose} /> : null}
      </SheetContent>
    </Sheet>
  )
}
