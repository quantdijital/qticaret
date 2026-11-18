import { useQuery } from "@tanstack/react-query"
import { Copy } from "lucide-react"
import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { DetailDialog } from "@qticaret/admin-ui/patterns/detail-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { RecordStepper } from "@qticaret/admin-ui/patterns/record-stepper"
import type { RecordSteps } from "@qticaret/admin-ui/patterns/record-stepper"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody, DialogSection } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { AiButton } from "@/features/ai/components/ai-button"
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
import { formatDateTime } from "@qticaret/admin-ui/lib/format"

const D = "media.detail"
// The server's limits (alt text docs/13 §8; the library's names)
const ALT_MAX = 250
const NAME_MAX = 200

// What the AI can read for an alt text: a stored raster picture (an SVG logo is a document)
const READABLE = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"])
const readable = (media: MediaDetail) =>
  media.file_id !== null && READABLE.has(media.mime_type ?? "")

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-center gap-3 py-2 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 break-words">{children}</dd>
    </div>
  )
}

interface WordsProps {
  media: MediaDetail
  canEdit: boolean
  /** Whether something is typed and not saved: the dialog asks before leaving it. */
  onDirtyChange: (dirty: boolean) => void
}

/** The name the library shows and the alt text; saved together, only while changed. */
function Words({ media, canEdit, onDirtyChange }: WordsProps) {
  const { t } = useTranslation()
  const update = useUpdateMedia(media.id)
  const [filename, setFilename] = useState(media.filename)
  const [alt, setAlt] = useState(media.alt ?? "")
  const dirty = filename.trim() !== media.filename || alt.trim() !== (media.alt ?? "")
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])
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
        <div className="flex items-center gap-1.5">
          <Input
            id="media-alt"
            className="min-w-0 flex-1"
            value={alt}
            maxLength={ALT_MAX}
            disabled={!canEdit}
            onChange={(event) => {
              setAlt(event.target.value)
            }}
          />
          {canEdit && readable(media) ? (
            <AiButton
              task="image_alt_text"
              entity={{ type: "media", id: media.id }}
              size="icon"
              label={t(`${D}.altAi`)}
              note={t("ai.suggest.imageNote")}
              onUse={(text) => {
                // Into the field only: the form's Save writes it
                setAlt(text)
              }}
            />
          ) : null}
        </div>
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

/** The picture and its words side by side, its facts under the words, where it is used below. */
function Detail({
  media,
  canEdit,
  onDirtyChange,
}: {
  media: MediaDetail
  canEdit: boolean
  onDirtyChange: (dirty: boolean) => void
}) {
  const { t } = useTranslation()
  const copy = () => {
    navigator.clipboard.writeText(media.url).then(
      () => toast.success(t(`${D}.copied`)),
      () => toast.error(t(`${D}.copyFailed`))
    )
  }
  return (
    <DialogBody>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted">
          <img
            src={media.url}
            alt={media.alt ?? ""}
            className="max-h-full max-w-full object-contain"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Words
            key={`${media.filename}|${media.alt ?? ""}`}
            media={media}
            canEdit={canEdit}
            onDirtyChange={onDirtyChange}
          />
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
        </div>
      </div>
      <DialogSection title={t(`${D}.usage`)}>
        <MediaUsage usage={media.usage} />
      </DialogSection>
    </DialogBody>
  )
}

/** Deleting it while nothing shows it; why not, while something does. */
function DeleteAction({ media, onDeleted }: { media: MediaDetail; onDeleted: () => void }) {
  const { t } = useTranslation()
  const remove = useDeleteMedia()
  const [confirming, setConfirming] = useState(false)
  const used = media.usage.length > 0
  return (
    <>
      <p className="self-center text-xs text-muted-foreground sm:mr-auto">
        {used ? t(`${D}.inUse`) : null}
      </p>
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
              onDeleted()
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
    </>
  )
}

interface MediaDetailDialogProps {
  /** The picture open; null while closed. */
  id: string | null
  /** Its place on the library's page: ‹ n / m › walks it. */
  steps: RecordSteps
  onClose: () => void
}

/**
 * One library picture in full: the picture, its name and alt text, who
 * uploaded it, its address to copy, where the shop shows it, and deleting
 * it while nothing does. The arrows go to the grid's next picture; a name
 * or alt text typed and not saved is asked about first. `lg`: the
 * picture beside its words.
 */
export function MediaDetailDialog({ id, steps, onClose }: MediaDetailDialogProps) {
  const { t } = useTranslation()
  const canEdit = useCan("catalog")
  const [dirty, setDirty] = useState(false)
  const { guard, confirm } = useDiscardGuard(dirty)
  const detail = useQuery({ ...mediaDetailQuery(id ?? ""), enabled: id !== null })
  const media = detail.data?.id === id ? detail.data : undefined
  const close = () => {
    setDirty(false)
    onClose()
  }
  return (
    <>
      <DetailDialog
        open={id !== null}
        onOpenChange={(open) => {
          if (!open) {
            close()
          }
        }}
        onCloseRequest={guard}
        size="lg"
        title={media ? media.filename : t(`${D}.title`)}
        description={media ? mediaFacts(media) : undefined}
        descriptionClassName="tabular-nums"
        headerAction={
          <RecordStepper
            {...steps}
            previousLabel={t(`${D}.previous`)}
            nextLabel={t(`${D}.next`)}
            onGo={(to) => {
              guard(() => {
                setDirty(false)
                steps.onGo(to)
              })
            }}
          />
        }
        footer={media && canEdit ? <DeleteAction media={media} onDeleted={close} /> : undefined}
      >
        {media ? (
          <Detail key={media.id} media={media} canEdit={canEdit} onDirtyChange={setDirty} />
        ) : (
          <DialogBody>
            {detail.isError ? (
              <ErrorState text={errorText(t, detail.error)} onRetry={() => void detail.refetch()} />
            ) : (
              <LoadingRows rows={5} />
            )}
          </DialogBody>
        )}
      </DetailDialog>
      {confirm}
    </>
  )
}
