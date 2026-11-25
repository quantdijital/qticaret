import { useTranslation } from "react-i18next"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import {
  BANNER_EYEBROW_MAX,
  BANNER_SPLIT_BUTTON_TONES,
  BANNER_SPLIT_EDGES,
  BANNER_SPLIT_ORNAMENTS,
} from "@qticaret/types"
import type { BannerSplitEdge } from "@qticaret/types"
import type { BannerSection } from "@/features/storefront/api/layout"
import { bannerEdgeId, bannerSplitLookId } from "./banner-groups"
import { StepChoice } from "./step-choice"
import { TextField } from "./fields"
import { HandNoteField } from "./hand-note-field"
import type { SectionFormProps } from "./form-props"
import { PREVIEW_IDS } from "./preview-fields"
import { useProblemText } from "./problem-text"

const B = "storefront.editor.banner"

/**
 * The split band's own words (adr/0077 Ek, "Bölünmüş bant"): the upper
 * line over the first picture's heading, its hand note (`HandNoteField`),
 * and a line telling that only the first
 * picture shows (the others stay, for a switch back).
 */
export function BannerSplitWords({ section, problems, onChange }: SectionFormProps<BannerSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  return (
    <>
      <TextField
        id={PREVIEW_IDS.text(section.id, "eyebrow")}
        label={t("storefront.editor.fields.eyebrow")}
        value={section.eyebrow ?? null}
        max={BANNER_EYEBROW_MAX}
        tokens
        placeholder={t(`${B}.eyebrowPlaceholder`)}
        error={problem(problems["eyebrow"], BANNER_EYEBROW_MAX)}
        onChange={(eyebrow) => {
          onChange({ ...section, eyebrow }, "eyebrow")
        }}
      />
      <HandNoteField
        sectionId={section.id}
        keys={B}
        value={section.note ?? null}
        problem={problems["note"]}
        onChange={(note) => {
          onChange({ ...section, note }, "note")
        }}
      />
      <p className="text-xs text-muted-foreground">{t(`${B}.splitFirst`)}</p>
    </>
  )
}

/** "Geçiş" (adr/0077 Ek): how the picture's inner edge meets the panel, straight or bowed. */
export function BannerEdgeField({
  section,
  onChange,
}: {
  section: BannerSection
  onChange: (section: BannerSection) => void
}) {
  const { t } = useTranslation()
  const id = bannerEdgeId(section.id)
  const value: BannerSplitEdge = section.edge ?? BANNER_SPLIT_EDGES[0]
  return (
    <div id={id} className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-sm font-medium">
        {t(`${B}.edge.label`)}{" "}
        <small className="text-[11px] font-normal text-muted-foreground">
          {t(`${B}.edge.term`)}
        </small>
      </span>
      <ToggleGroup
        type="single"
        variant="outline"
        aria-labelledby={`${id}-label`}
        value={value}
        onValueChange={(next) => {
          // Picking the chosen step again keeps it: the split always has one
          if (next !== "") onChange({ ...section, edge: next as BannerSplitEdge })
        }}
        className="grid w-full grid-cols-2"
      >
        {BANNER_SPLIT_EDGES.map((edge) => (
          <ToggleGroupItem
            key={edge}
            value={edge}
            data-state={value === edge ? "on" : "off"}
            className="h-auto min-w-0 px-1.5 py-2 text-xs data-[state=on]:bg-accent data-[state=on]:font-medium data-[state=on]:text-accent-foreground"
          >
            <span className="truncate">{t(`${B}.edge.${edge}`)}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

/** The split's first button's colour and its flower spray, each today's band by default. */
const BANNER_SPLIT_LOOK = {
  button_tone: BANNER_SPLIT_BUTTON_TONES,
  ornament: BANNER_SPLIT_ORNAMENTS,
} as const

/** "Düğme rengi" and "Süs" (the split's own), under "Diziliş" beside its edge. */
export function BannerSplitLookFields({
  section,
  onChange,
}: {
  section: BannerSection
  onChange: (section: BannerSection) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      {(Object.keys(BANNER_SPLIT_LOOK) as (keyof typeof BANNER_SPLIT_LOOK)[]).map((key) => {
        const steps: readonly string[] = BANNER_SPLIT_LOOK[key]
        const first = steps[0] ?? ""
        return (
          <StepChoice<string>
            key={key}
            id={bannerSplitLookId(section.id, key)}
            label={t(`${B}.${key}.label`)}
            term={t(`${B}.${key}.term`)}
            hint={t(`${B}.${key}.hint`)}
            steps={steps}
            value={section[key] ?? first}
            fallback={first}
            nameOf={(step) => t(`${B}.${key}.${step}`)}
            onChange={(step) => {
              onChange({ ...section, [key]: step })
            }}
          />
        )
      })}
    </>
  )
}
