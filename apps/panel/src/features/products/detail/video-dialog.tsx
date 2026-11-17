import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { DetailDialog } from "@qticaret/admin-ui/patterns/detail-dialog"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { useRemoveVideo, useRetryVideo } from "@/features/products/api/videos"
import type { ProductVideo } from "@/features/products/api/videos"
import {
  formatDimensions,
  formatDuration,
  offersRetry,
  sourceGone,
  videoErrorKey,
  videoFacts,
  videoTileLabel,
} from "@/features/products/video-facts"
import { errorText } from "@/lib/errors"
import { Fact, TitleForm, VideoPreview } from "./video-parts"

const V = "products.videos"

/** "Yeniden dene" and "Videoyu kaldır" (asked first): the footer's actions. */
function Actions({
  productId,
  video,
  onRemoved,
}: {
  productId: string
  video: ProductVideo
  onRemoved: () => void
}) {
  const { t } = useTranslation()
  const retry = useRetryVideo(productId)
  const remove = useRemoveVideo(productId)
  const [confirming, setConfirming] = useState(false)
  return (
    <>
      {offersRetry(video) ? (
        <Button
          variant="outline"
          className="sm:mr-auto"
          disabled={retry.isPending}
          onClick={() => {
            retry.mutate(video.id, {
              onSuccess: () => toast.success(t(`${V}.retried`)),
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }}
        >
          {t(`${V}.retry`)}
        </Button>
      ) : null}
      <Button
        variant="outline"
        className="text-destructive-text"
        disabled={remove.isPending}
        onClick={() => {
          setConfirming(true)
        }}
      >
        {t(`${V}.remove`)}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(`${V}.removeTitle`)}
        description={t(`${V}.removeDescription`)}
        confirmLabel={t(`${V}.remove`)}
        destructive
        onConfirm={() => {
          remove.mutate(video.id, {
            onSuccess: () => {
              toast.success(t(`${V}.removed`))
              onRemoved()
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
    </>
  )
}

/** Its state in words; a failure's sentence under it, and what to do when it cannot be retried. */
function State({ video }: { video: ProductVideo }) {
  const { t } = useTranslation()
  const label = videoTileLabel(video.status)
  const failed = video.status === "failed"
  return (
    <>
      <Fact label={t(`${V}.state`)}>
        <StatusBadge tone={failed ? "danger" : label ? "neutral" : "success"}>
          {t(label ? `${V}.status.${label}` : `${V}.status.ready`)}
        </StatusBadge>
      </Fact>
      {failed ? (
        <p className="py-2 text-[13px] text-destructive-text">
          {t(videoErrorKey(video.error_code))}
          {sourceGone(video) ? ` ${t(`${V}.sourceGone`)}` : null}
        </p>
      ) : null}
    </>
  )
}

interface VideoDialogProps {
  productId: string
  /** The video open, as the list has it now (polled while it is processed); null: closed. */
  video: ProductVideo | null
  onClose: () => void
}

/**
 * One product video (adr/0069 §10), the image dialog's size (`lg`): the
 * clip beside its title, its length and size, its state; a failure's
 * sentence, "Yeniden dene" for the infrastructure's, and removing it.
 */
export function VideoDialog({ productId, video, onClose }: VideoDialogProps) {
  const { t } = useTranslation()
  const [dirty, setDirty] = useState(false)
  const { guard, confirm } = useDiscardGuard(dirty)
  const close = () => {
    setDirty(false)
    onClose()
  }
  return (
    <>
      <DetailDialog
        open={video !== null}
        onOpenChange={(open) => {
          if (!open) {
            close()
          }
        }}
        onCloseRequest={guard}
        size="lg"
        title={t(`${V}.dialogTitle`)}
        description={video ? videoFacts(video) || undefined : undefined}
        descriptionClassName="tabular-nums"
        footer={
          video ? <Actions productId={productId} video={video} onRemoved={close} /> : undefined
        }
      >
        {video ? (
          <DialogBody>
            <div className="grid gap-6 sm:grid-cols-2">
              <VideoPreview video={video} />
              <div className="flex min-w-0 flex-col gap-4">
                <TitleForm
                  key={`${video.id}|${video.title ?? ""}`}
                  productId={productId}
                  video={video}
                  onDirtyChange={setDirty}
                />
                <dl className="divide-y">
                  <State video={video} />
                  <Fact label={t(`${V}.duration`)}>
                    {video.duration_ms ? formatDuration(video.duration_ms) : "—"}
                  </Fact>
                  <Fact label={t(`${V}.dimensions`)}>{formatDimensions(video) ?? "—"}</Fact>
                </dl>
              </div>
            </div>
          </DialogBody>
        ) : null}
      </DetailDialog>
      {confirm}
    </>
  )
}
