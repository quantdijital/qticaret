import type { TFunction } from "i18next"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import type { AiFailure } from "@/features/ai/api/suggestions"
import { AiBackgroundCompare } from "@/features/ai/components/ai-background-compare"
import { AiConnectHint } from "@/features/ai/components/ai-connect-hint"
import { AiServicePicker } from "@/features/ai/components/ai-service-picker"
import { aiFailureText, serviceName } from "@/features/ai/failure-text"
import { useAiBackground, useBackgroundTask } from "@/features/ai/use-ai-background"
import type { MediaDetail } from "@/features/media/api/media"

const B = "ai.background"

/** A job's refusal in words: the quota or storage of the package, else the AI core's words. */
function failureText(t: TFunction, failure: unknown, service: string | null): string {
  const code = (failure as Partial<AiFailure> | null)?.code
  if (code === "plan.limit_reached") {
    return t(`${B}.limit`)
  }
  return code === null ? t(`${B}.failed`) : aiFailureText(t, failure, service)
}

export interface AiBackgroundDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The picture to clean: its media record and address; it is never changed. */
  source: { id: string; url: string }
  /** What "Kullan" does here, one line under the pictures (adds it to the product, keeps it in the library). */
  useNote: string
  /** Gets the new picture; the dialog closes once it resolves. */
  onUse: (picture: MediaDetail) => Promise<void> | void
  /** Why "Kullan" cannot be done now (the product has 20 pictures); null: it can. */
  blocked?: string | null
}

/**
 * "Arka planı temizle" (docs/22 Aşama 4, adr/0071 §13): the background
 * made transparent or white by a service, as a new picture beside the
 * original. The job runs in the background (202, then followed); the
 * result is shown beside the original. Nothing is written until "Kullan";
 * "Vazgeç" turns the suggestion down and the unused picture is swept.
 */
export function AiBackgroundDialog({
  open,
  onOpenChange,
  source,
  useNote,
  onUse,
  blocked = null,
}: AiBackgroundDialogProps) {
  const { t } = useTranslation()
  const { view, optionsOf } = useBackgroundTask()
  const usable = view?.usable ?? []
  const remembered = view?.preference && usable.includes(view.preference) ? view.preference : null
  const [picked, setPicked] = useState<string | null>(null)
  const service = picked && usable.includes(picked) ? picked : (remembered ?? usable[0] ?? "")
  const offered = optionsOf(service)
  const [chosen, setChosen] = useState<string | null>(null)
  const option = chosen && offered.includes(chosen) ? chosen : (offered[0] ?? "")
  const [ranWith, setRanWith] = useState(option)
  const [using, setUsing] = useState(false)
  const job = useAiBackground(source.id)
  const { state } = job
  const running = state.status === "running"

  const close = () => {
    job.dismiss()
    onOpenChange(false)
  }
  const start = () => {
    setRanWith(option)
    void job.start(option, usable.length > 1 ? service : undefined)
  }
  const use = async () => {
    setUsing(true)
    try {
      const picture = await job.accept()
      if (picture) {
        await onUse(picture)
      }
      onOpenChange(false)
    } finally {
      setUsing(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          close()
        }
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t(`${B}.title`)}</DialogTitle>
          <DialogDescription>{t(`${B}.description`)}</DialogDescription>
        </DialogHeader>
        {usable.length === 0 ? (
          <AiConnectHint onClose={close} words="ai.background.hint" />
        ) : (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {offered.length > 1 ? (
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={option}
                  disabled={running}
                  aria-label={t(`${B}.option`)}
                  onValueChange={(next) => {
                    if (next) {
                      setChosen(next)
                    }
                  }}
                >
                  {offered.map((id) => (
                    <ToggleGroupItem key={id} value={id}>
                      {t(`ai.options.${id}`, { defaultValue: id })}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t(`${B}.onlyOption`, {
                    name: serviceName(t, service),
                    option: t(`ai.options.${option}`, { defaultValue: option }),
                  })}
                </p>
              )}
              <div className="min-w-48 flex-1">
                <AiServicePicker
                  services={usable}
                  value={service}
                  disabled={running}
                  onChange={setPicked}
                />
              </div>
            </div>
            <AiBackgroundCompare
              before={source.url}
              state={state}
              transparent={ranWith === "transparent"}
            />
            {state.status === "error" ? (
              <p className="text-sm text-destructive" role="alert">
                {failureText(t, state.failure, state.service)}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {state.status === "ready"
                ? (blocked ?? useNote)
                : t(`${B}.note`, { name: serviceName(t, service) })}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close}>
            {t("ai.suggest.dismiss")}
          </Button>
          {usable.length === 0 ? null : state.status === "ready" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  job.dismiss()
                  start()
                }}
              >
                {t("ai.suggest.retry")}
              </Button>
              <Button type="button" disabled={blocked !== null || using} onClick={() => void use()}>
                {t("ai.suggest.use")}
              </Button>
            </>
          ) : (
            <Button type="button" disabled={running || option === ""} onClick={start}>
              {state.status === "error" ? t("ai.suggest.retry") : t(`${B}.start`)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
