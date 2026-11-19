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
import { AiSceneCustom } from "@/features/ai/components/ai-scene-custom"
import { AiServicePicker } from "@/features/ai/components/ai-service-picker"
import { aiFailureText, serviceName } from "@/features/ai/failure-text"
import { useAiBackground } from "@/features/ai/use-ai-background"
import { useAiImageModes } from "@/features/ai/use-ai-image-modes"
import { CUSTOM_SCENE, useCustomScene } from "@/features/ai/use-custom-scene"
import type { AiImageMode } from "@/features/ai/use-ai-image-modes"
import type { MediaDetail } from "@/features/media/api/media"

const B = "ai.background"
const S = "ai.scene"

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
 * "Görseli düzenle", two modes: "Arka planı temizle" (docs/22 Aşama 4,
 * adr/0071 §13): the background
 * made transparent or white by a service, as a new picture beside the
 * original; or "Sahneye yerleştir" (Aşama 7): the product set in one of
 * the shop's scenes (its own saved ones, then its sector pack's), or one
 * typed once under "Özel" (`AiSceneCustom`), kept among its own if asked.
 * The job runs in the background (202, then followed); the result is
 * shown beside the original. Nothing is written until "Kullan";
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
  const { modes, sceneOffered } = useAiImageModes()
  const [chosenMode, setMode] = useState<AiImageMode>("background")
  const mode: AiImageMode = sceneOffered ? chosenMode : "background"
  const current = modes[mode]
  const P = mode === "scene" ? S : B
  const usable = current.view?.usable ?? []
  const preference = current.view?.preference
  const remembered = preference && usable.includes(preference) ? preference : null
  const [picked, setPicked] = useState<string | null>(null)
  const service = picked && usable.includes(picked) ? picked : (remembered ?? usable[0] ?? "")
  const scene = mode === "scene"
  // A scene can also be typed once: "Özel" closes the chips
  const offered = [...current.optionsOf(service), ...(scene ? [CUSTOM_SCENE] : [])]
  const [chosen, setChosen] = useState<string | null>(null)
  const option = chosen && offered.includes(chosen) ? chosen : (offered[0] ?? "")
  const typing = scene && option === CUSTOM_SCENE
  const custom = useCustomScene()
  const labelOf = (id: string) =>
    id === CUSTOM_SCENE ? t(`${S}.custom.chip`) : current.labelOf(id)
  const [ranWith, setRanWith] = useState(option)
  const [using, setUsing] = useState(false)
  const job = useAiBackground(source.id, current.task)
  const { state } = job
  const running = state.status === "running"

  const close = () => {
    job.dismiss()
    onOpenChange(false)
  }
  const start = () => {
    setRanWith(option)
    const picked = usable.length > 1 ? service : undefined
    if (!typing) {
      void job.start(option, picked)
      return
    }
    // Typed once, or kept first among the shop's scenes and then asked for by its id
    void custom.submit().then((ask) => {
      if (ask === null) {
        return
      }
      if ("option" in ask) {
        setChosen(ask.option)
        void job.start(ask.option, picked)
      } else {
        void job.start("", picked, ask.prompt)
      }
    })
  }
  const switchMode = (next: AiImageMode) => {
    // A result of the other mode is turned down; its picture goes with the sweep
    job.dismiss()
    setChosen(null)
    setPicked(null)
    setMode(next)
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
          <DialogTitle>{t(`${B}.dialog`)}</DialogTitle>
          <DialogDescription>{t(`${P}.description`)}</DialogDescription>
        </DialogHeader>
        {sceneOffered ? (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            className="self-start"
            value={mode}
            disabled={running}
            aria-label={t(`${S}.mode`)}
            onValueChange={(next) => {
              if (next === "background" || next === "scene") {
                switchMode(next)
              }
            }}
          >
            <ToggleGroupItem value="background">{t(`${B}.title`)}</ToggleGroupItem>
            <ToggleGroupItem value="scene">{t(`${S}.title`)}</ToggleGroupItem>
          </ToggleGroup>
        ) : null}
        {usable.length === 0 ? (
          <AiConnectHint onClose={close} words={`${P}.hint`} />
        ) : (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {offered.length > 1 || scene ? (
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  // Scenes are chips apart that wrap: twelve of the shop's own and "Özel"
                  spacing={scene ? 1.5 : 0}
                  className={scene ? "flex-wrap" : undefined}
                  value={option}
                  disabled={running}
                  aria-label={t(`${P}.option`)}
                  onValueChange={(next) => {
                    if (next) {
                      setChosen(next)
                    }
                  }}
                >
                  {offered.map((id) => (
                    <ToggleGroupItem key={id} value={id}>
                      {labelOf(id)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t(`${P}.onlyOption`, {
                    name: serviceName(t, service),
                    option: current.labelOf(option),
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
            {typing ? <AiSceneCustom scene={custom} disabled={running || custom.saving} /> : null}
            <AiBackgroundCompare
              before={source.url}
              state={state}
              transparent={mode === "background" && ranWith === "transparent"}
              afterAlt={t(`${P}.afterAlt`)}
            />
            {state.status === "error" ? (
              <p className="text-sm text-destructive" role="alert">
                {failureText(t, state.failure, state.service)}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {state.status === "ready"
                ? (blocked ?? useNote)
                : t(`${P}.note`, { name: serviceName(t, service) })}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="cancel" onClick={close}>
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
            <Button
              type="button"
              disabled={running || option === "" || (typing && (!custom.ready || custom.saving))}
              onClick={start}
            >
              {state.status === "error" ? t("ai.suggest.retry") : t(`${P}.start`)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
