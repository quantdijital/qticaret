import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import type { AnySection, MainSection } from "@/features/storefront/api/layout"
import type { Problem } from "@/features/storefront/layout/problems"
import { fromLocalInput, toLocalInput } from "@/features/storefront/layout/schedule"
import { FIELD_IDS } from "./field-registry"
import { useProblemText } from "./problem-text"

const P = "storefront.editor.panel"

interface ScheduleFieldsProps {
  /** Not a main section: those always show (adr/0049 Ek 2026-11-14 §5). */
  section: Exclude<AnySection, MainSection>
  problem: Problem | undefined
  onChange: (section: AnySection, field?: string) => void
}

/**
 * Whether the section shows, and from when until when (a campaign's
 * banner): in the browser's own time, kept by the server as a moment.
 * The two moments side by side where both fit whole.
 */
export function ScheduleFields({ section, problem, onChange }: ScheduleFieldsProps) {
  const { t } = useTranslation()
  const text = useProblemText()
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <label htmlFor={FIELD_IDS.visible(section.id)} className="flex flex-col gap-0.5 text-sm">
          {t(`${P}.visible`)}
          <span className="text-xs text-muted-foreground">{t(`${P}.visibleHint`)}</span>
        </label>
        <Switch
          id={FIELD_IDS.visible(section.id)}
          checked={section.visible}
          onCheckedChange={(visible) => {
            onChange({ ...section, visible })
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t(`${P}.scheduleHint`)}</p>
      <div className="grid gap-4 @min-[28rem]:grid-cols-2">
        <Field label={t(`${P}.startsAt`)} htmlFor={FIELD_IDS.starts(section.id)}>
          <Input
            id={FIELD_IDS.starts(section.id)}
            type="datetime-local"
            value={toLocalInput(section.starts_at)}
            onChange={(event) => {
              onChange({ ...section, starts_at: fromLocalInput(event.target.value) }, "starts")
            }}
          />
        </Field>
        <Field label={t(`${P}.endsAt`)} htmlFor={FIELD_IDS.ends(section.id)} error={text(problem)}>
          <Input
            id={FIELD_IDS.ends(section.id)}
            type="datetime-local"
            value={toLocalInput(section.ends_at)}
            aria-invalid={Boolean(problem)}
            onChange={(event) => {
              onChange({ ...section, ends_at: fromLocalInput(event.target.value) }, "ends")
            }}
          />
        </Field>
      </div>
    </>
  )
}
