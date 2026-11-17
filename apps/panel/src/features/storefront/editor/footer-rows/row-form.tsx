import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FOOTER_ROW_DEFAULTS, FOOTER_ROW_LAYOUTS, FOOTER_ROW_SETTINGS } from "@qticaret/types"
import type { FooterRowLayout } from "@qticaret/types"
import type { FooterRow } from "@/features/storefront/api/layout"
import { NamedGroup } from "../named-group"
import { SwitchRow } from "../theme-fields"
import { StepChoice } from "../forms/step-choice"
import { FOOTER_ROWS_FIELD_IDS, FR } from "./footer-rows-fields"
import type { RowField } from "./footer-rows-fields"

/** A split drawn in small: its columns side by side, each as wide as its share. */
export function SplitSketch({ layout }: { layout: FooterRowLayout }) {
  const shares = layout.split("-").map(Number)
  const total = shares.reduce((sum, share) => sum + share, 0)
  const gap = 2
  const unit = (36 - gap * (shares.length - 1)) / total
  // Each column starts after the ones before it and their gaps
  const starts = shares.map((_, at) =>
    shares.slice(0, at).reduce((sum, share) => sum + share * unit + gap, 0)
  )
  return (
    <svg aria-hidden="true" viewBox="0 0 36 12" className="h-3 w-9">
      {shares.map((share, at) => (
        <rect
          key={at}
          x={starts[at]}
          y={0}
          width={share * unit}
          height={12}
          rx={1.5}
          className="fill-current opacity-50"
        />
      ))}
    </svg>
  )
}

/**
 * A footer row's settings (adr/0070 §7): its split under "İçerik" (the
 * columns it has, drawn in small; fewer columns put the blocks of those
 * let go into the last one kept, said here), its ground, room, alignment
 * and line above under "Stil", and how many columns stand side by side
 * on a phone.
 */
export function RowForm({
  row,
  onChange,
  onLayout,
}: {
  row: FooterRow
  onChange: (row: FooterRow) => void
  /** The split changed: the rows' change, whether blocks were gathered into the last column. */
  onLayout: (layout: FooterRowLayout) => boolean
}) {
  const { t } = useTranslation()
  const [merged, setMerged] = useState(false)
  const id = (field: RowField) => FOOTER_ROWS_FIELD_IDS.row(row.id, field)
  const label = (field: RowField) => ({
    label: t(`${FR}.row.${field}.label`),
    term: t(`${FR}.row.${field}.term`),
  })
  return (
    <>
      <NamedGroup name="columns">
        <div className="flex flex-col gap-2">
          <StepChoice
            id={id("layout")}
            {...label("layout")}
            hint={t(`${FR}.row.layout.hint`)}
            steps={FOOTER_ROW_LAYOUTS}
            value={row.layout}
            fallback={FOOTER_ROW_DEFAULTS.layout}
            columns={5}
            nameOf={(step) => step.replaceAll("-", "·")}
            drawOf={(step) => <SplitSketch layout={step} />}
            onChange={(layout) => {
              setMerged(onLayout(layout))
            }}
          />
          <p role="status" className="text-xs text-muted-foreground">
            {merged ? t(`${FR}.row.merged`) : ""}
          </p>
        </div>
      </NamedGroup>
      <NamedGroup name="appearance">
        <div className="flex flex-col gap-5">
          <StepChoice
            id={id("ground")}
            {...label("ground")}
            hint={t(`${FR}.row.ground.hint`)}
            steps={FOOTER_ROW_SETTINGS.ground}
            value={row.ground}
            fallback={FOOTER_ROW_DEFAULTS.ground}
            columns={3}
            nameOf={(step) => t(`${FR}.row.ground.${step}`)}
            onChange={(ground) => {
              onChange({ ...row, ground })
            }}
          />
          <StepChoice
            id={id("space")}
            {...label("space")}
            steps={FOOTER_ROW_SETTINGS.space}
            value={row.space}
            fallback={FOOTER_ROW_DEFAULTS.space}
            nameOf={(step) => t(`${FR}.row.space.${step}`)}
            onChange={(space) => {
              onChange({ ...row, space })
            }}
          />
          <StepChoice
            id={id("align")}
            {...label("align")}
            steps={FOOTER_ROW_SETTINGS.align}
            value={row.align}
            fallback={FOOTER_ROW_DEFAULTS.align}
            nameOf={(step) => t(`${FR}.row.align.${step}`)}
            onChange={(align) => {
              onChange({ ...row, align })
            }}
          />
          <SwitchRow
            id={id("divider")}
            {...label("divider")}
            checked={row.divider}
            onChange={(divider) => {
              onChange({ ...row, divider })
            }}
          />
        </div>
      </NamedGroup>
      <NamedGroup name="phone">
        <StepChoice
          id={id("phone_columns")}
          {...label("phone_columns")}
          hint={t(`${FR}.row.phone_columns.hint`)}
          steps={FOOTER_ROW_SETTINGS.phone_columns}
          value={row.phone_columns}
          fallback={FOOTER_ROW_DEFAULTS.phone_columns}
          nameOf={(step) => t(`${FR}.row.phone_columns.${String(step)}`)}
          onChange={(phone_columns) => {
            onChange({ ...row, phone_columns })
          }}
        />
      </NamedGroup>
    </>
  )
}
