import { Eye } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { PresetCard as Preset } from "./api"
import { DesignThumb } from "./design-thumb"
import { hasNewVersion, shownMember } from "./families"
import type { PresetFamily } from "./families"
import { LookFacts } from "./look-facts"
import { LookState } from "./look-state"
import { thumbColors } from "./thumb-colors"

const G = "storefront.gallery"

/** A look's one state (live, else in the draft) and a newer version; its tone shows in its picture. */
export function PresetBadges({ preset }: { preset: Preset }) {
  return (
    <LookState
      live={preset.live !== null}
      inDraft={preset.in_draft !== null}
      newer={hasNewVersion(preset)}
    />
  )
}

/** The look's picture where it has one, else its sketch. */
export function PresetPicture({
  preset,
  className,
}: {
  preset: Preset
  className?: string | undefined
}) {
  const { t } = useTranslation()
  return preset.preview_url ? (
    <img
      src={preset.preview_url}
      alt={t(`${G}.thumbAlt`, { name: preset.name })}
      loading="lazy"
      className={cn("aspect-[16/10] w-full rounded-md border object-cover object-top", className)}
    />
  ) : (
    <DesignThumb summary={preset.summary} className={className} />
  )
}

interface PresetCardProps {
  family: PresetFamily
  onPreview: (preset: Preset) => void
  onApply: (preset: Preset) => void
  busy: boolean
}

/**
 * A ready-made look (adr/0063 §7): its sketch, name, description and
 * state; a family of colour sets is one card with the set picked here
 * (Shopify's theme styles), the card showing the one picked.
 */
export function PresetCard({ family, onPreview, onApply, busy }: PresetCardProps) {
  const { t } = useTranslation()
  const ids = useId()
  const [picked, setPicked] = useState(() => shownMember(family)?.code ?? "")
  const preset = family.members.find((each) => each.code === picked) ?? family.members[0]
  if (!preset) {
    return null
  }
  const shown =
    family.members.length > 1 && preset.swatch ? `${family.name} · ${preset.swatch}` : family.name
  return (
    <article
      aria-labelledby={`${ids}-title`}
      className="flex min-w-0 flex-col gap-2.5 rounded-lg border bg-card p-2.5 shadow-card"
    >
      <PresetPicture preset={preset} />
      <div className="flex flex-1 flex-col gap-1.5 px-0.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <h3 id={`${ids}-title`} className="text-sm leading-6 font-semibold">
              {family.name}
            </h3>
            <span
              title={t(`${G}.presets.sectorOf`, { sector: preset.sector.name })}
              className="rounded-sm border px-1.5 text-[11px] leading-4 text-muted-foreground"
            >
              {preset.sector.name}
            </span>
          </div>
          <PresetBadges preset={preset} />
        </div>
        <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{preset.description}</p>
        <LookFacts summary={preset.summary} />
        {family.members.length > 1 ? (
          <RadioGroup
            aria-label={t(`${G}.presets.colors`)}
            value={preset.code}
            onValueChange={setPicked}
            className="flex flex-wrap gap-2"
          >
            {family.members.map((member) => {
              const colors = thumbColors(member.summary.colors)
              const label = member.swatch ?? member.name
              return (
                <label
                  key={member.code}
                  htmlFor={`${ids}-${member.code}`}
                  title={label}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
                >
                  <RadioGroupItem id={`${ids}-${member.code}`} value={member.code} />
                  <span aria-hidden className="flex">
                    <span
                      className="block size-3.5 rounded-full border border-background"
                      style={{ backgroundColor: colors.primary }}
                    />
                    <span
                      className="-ml-1 block size-3.5 rounded-full border border-background"
                      style={{ backgroundColor: colors.accent }}
                    />
                  </span>
                  {label}
                </label>
              )
            })}
          </RadioGroup>
        ) : null}
      </div>
      <div className="mt-auto flex flex-wrap justify-end gap-2 px-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t(`${G}.presets.previewOf`, { name: shown })}
          onClick={() => {
            onPreview(preset)
          }}
        >
          <Eye />
          {t(`${G}.presets.preview`)}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          aria-label={t(`${G}.presets.applyOf`, { name: shown })}
          onClick={() => {
            onApply(preset)
          }}
        >
          {t(`${G}.presets.apply`)}
        </Button>
      </div>
    </article>
  )
}
