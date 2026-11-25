import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { AI_TARGET_CAPABILITIES, aiTargetUncapped } from "@qticaret/types/control-plane"
import type { AiTargetCapability } from "@qticaret/types/control-plane"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Label } from "@qticaret/admin-ui/ui/label"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { useSaveSettings } from "@/features/ai-credits/api/mutations"
import type { AiProvider, AiSettingsAnswer } from "@/features/ai-credits/api/schemas"
import { capabilityName, serviceName } from "@/features/ai-credits/words"
import { isStepUpCancelled } from "@/lib/step-up"
import { settingsErrorText, useSettingsDraft } from "./settings-draft"

const OFF = "off"
const choiceOf = (service: string, model: string) => `${service}|${model}`

interface Option {
  value: string
  label: string
  /** Why it cannot be chosen; none when it can. */
  why: string | null
}

/**
 * The options for one capability: off, then each service and model the
 * shared table allows. A service without a key, or whose output no
 * documented field caps (Gemini's text and image reading,
 * `aiTargetUncapped`: the server would answer `cp.ai_route_uncapped`), is
 * shown but cannot be chosen, with the reason.
 */
function optionsFor(
  t: ReturnType<typeof useTranslation>["t"],
  capability: AiTargetCapability,
  targets: AiSettingsAnswer["targets"],
  keyed: ReadonlySet<string>
): Option[] {
  const options: Option[] = [{ value: OFF, label: t("aiCredits.routing.none"), why: null }]
  for (const target of targets) {
    const name = serviceName(t, target.service)
    for (const model of target.capabilities[capability] ?? []) {
      const why = aiTargetUncapped(target.service, capability)
        ? t("aiCredits.routing.uncapped", { service: name })
        : keyed.has(target.service)
          ? null
          : t("aiCredits.routing.noKey", { service: name })
      options.push({ value: choiceOf(target.service, model), label: `${name} · ${model}`, why })
    }
  }
  return options
}

type Draft = Record<AiTargetCapability, string>

const draftOf = (routing: AiSettingsAnswer["settings"]["routing"]): Draft =>
  Object.fromEntries(
    AI_TARGET_CAPABILITIES.map((capability) => {
      const route = routing[capability]
      return [capability, route ? choiceOf(route.service, route.model) : OFF]
    })
  ) as Draft

const keep = (draft: Draft) => draft

/** Yönlendirme (adr/0085 §2): each capability's service and model, saved whole. */
export function RoutingCard({
  answer,
  providers,
}: {
  answer: AiSettingsAnswer
  providers: AiProvider[]
}) {
  const { t } = useTranslation()
  const save = useSaveSettings()
  const {
    draft,
    setDraft,
    base: saved,
    guard,
  } = useSettingsDraft(answer.settings, (settings) => draftOf(settings.routing), keep)
  const [failure, setFailure] = useState<string | null>(null)
  const keyed = new Set(providers.filter((each) => each.has_key).map((each) => each.service))
  const dirty = AI_TARGET_CAPABILITIES.some((capability) => draft[capability] !== saved[capability])
  const submit = () => {
    setFailure(null)
    const routing = Object.fromEntries(
      AI_TARGET_CAPABILITIES.map((capability) => {
        const [service, model] = draft[capability].split("|")
        return [
          capability,
          draft[capability] === OFF || !service || !model ? null : { service, model },
        ]
      })
    )
    save.mutate(
      (current) => {
        guard(current)
        return { routing }
      },
      {
        onSuccess: () => {
          toast.success(t("aiCredits.routing.done"))
        },
        onError: (error) => {
          if (!isStepUpCancelled(error)) {
            setFailure(settingsErrorText(t, error))
          }
        },
      }
    )
  }
  return (
    <SectionCard
      title={t("aiCredits.routing.title")}
      description={t("aiCredits.routing.text")}
      action={
        <Button disabled={!dirty || save.isPending} onClick={submit}>
          {t("common.save")}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {AI_TARGET_CAPABILITIES.map((capability) => {
          const label = `routing-${capability}`
          return (
            <div key={capability} className="flex flex-col gap-2">
              <p id={label} className="text-sm font-medium">
                {t("aiCredits.routing.label", { capability: capabilityName(t, capability) })}
              </p>
              <RadioGroup
                aria-labelledby={label}
                value={draft[capability]}
                onValueChange={(next) => {
                  setDraft((prev) => ({ ...prev, [capability]: next }))
                }}
                className="flex flex-col gap-2"
              >
                {optionsFor(t, capability, answer.targets, keyed).map((option) => {
                  const id = `${label}-${option.value.replace(/[^a-z0-9_-]/gi, "-")}`
                  return (
                    <div key={option.value} className="flex items-start gap-2">
                      <RadioGroupItem
                        id={id}
                        value={option.value}
                        disabled={option.why !== null}
                        aria-describedby={option.why ? `${id}-why` : undefined}
                        className="mt-0.5"
                      />
                      <div className="flex min-w-0 flex-col">
                        <Label htmlFor={id} className="font-normal break-words">
                          {option.label}
                        </Label>
                        {option.why ? (
                          <span id={`${id}-why`} className="text-xs text-muted-foreground">
                            {option.why}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </RadioGroup>
            </div>
          )
        })}
        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}
      </div>
    </SectionCard>
  )
}
