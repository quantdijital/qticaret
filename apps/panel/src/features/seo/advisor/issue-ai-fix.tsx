import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { AiButton } from "@/features/ai/components/ai-button"
import type { AdvisorAiField, AdvisorKind, SeoIssue } from "@/features/seo/api/advisor"
import { FILLABLE_FIELDS, aiEntityOf, sendAiFill } from "./ai-fill"

/** The manual fix whose target holds the field: the advisor's own way to it. */
const FIELD_ACTIONS: Partial<Record<AdvisorAiField, string>> = {
  seo_title: "edit_title",
  seo_description: "edit_description",
}

/** The SEO card's own element ids for its fields (`SeoTextFields`). */
const FIELD_IDS: Partial<Record<AdvisorAiField, (id: string) => string>> = {
  seo_title: (id) => `seo-title-${id}`,
  seo_description: (id) => `seo-description-${id}`,
}

// After the layer closes and hands the focus back to its button: then the field takes it
const FOCUS_DELAY_MS = 120

/**
 * "Yapay zekâyla düzelt" on a finding an AI task fixes (docs/22 "Aşama 3"):
 * the shared AI button asks for a suggestion in its layer; "Kullan" puts
 * it in the record's form (`useAiFill`), takes the person to the field and
 * leaves the saving to them. Nothing is written here (adr/0005). Drawn
 * only where the form can take it; the button itself draws nothing for a
 * role the task does not allow and the connect hint where no service is.
 */
export function IssueAiFix({
  issue,
  kind,
  id,
  finding,
  targets,
  onTarget,
}: {
  issue: SeoIssue
  kind: AdvisorKind
  id: string
  /** The finding's sentence, for the button's name. */
  finding: string
  targets: Readonly<Record<string, string>>
  onTarget: (target: string) => void
}) {
  const { t } = useTranslation()
  const ai = issue.ai
  const entity = aiEntityOf(kind, id)
  if (!ai || !entity || !FILLABLE_FIELDS.includes(ai.field)) {
    return null
  }
  const use = (text: string) => {
    sendAiFill(entity.type, id, ai.field, text)
    const action = FIELD_ACTIONS[ai.field]
    const target = action ? targets[action] : undefined
    if (target) {
      onTarget(target)
    }
    const field = FIELD_IDS[ai.field]?.(id)
    if (field) {
      window.setTimeout(() => {
        document.getElementById(field)?.focus({ preventScroll: true })
      }, FOCUS_DELAY_MS)
    }
    toast.success(t("seo.advisor.aiFilled"))
  }
  return (
    <AiButton
      task={ai.task}
      entity={entity}
      onUse={use}
      label={t("seo.advisor.aiFixLabel", { finding })}
      text={t("seo.advisor.aiFix")}
    />
  )
}
