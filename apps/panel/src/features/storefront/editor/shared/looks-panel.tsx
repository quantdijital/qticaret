import { SwatchBook } from "lucide-react"
import { useTranslation } from "react-i18next"
import { LOW_STOCK_LIMITS } from "@/features/storefront/layout/settings-problems"
import { useProblemText } from "../forms/problem-text"
import { CountField } from "../forms/fields"
import { Panel, PanelGroup } from "../panel-header"
import { SwitchRow } from "../theme-fields"
import type { SharedPanelProps } from "./shared-props"
import { SwatchList } from "./swatch-list"

const S = "storefront.editor.shared"

/**
 * How the theme marks products (adr/0049 Ek 2026-11-06): the card's "Az
 * kaldı" line and the colour names shown as swatches on cards, filters and
 * the product page. Part of the draft, published with the design.
 */
export function LooksPanel({ settings, problems, onChange, onBack }: SharedPanelProps) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const { low_stock: low } = settings
  return (
    <Panel icon={SwatchBook} title={t(`${S}.looks.title`)} onBack={onBack}>
      <p className="border-b px-5 py-4 text-[13px] leading-5 text-muted-foreground">
        {t(`${S}.looks.description`)}
      </p>
      <PanelGroup title={t(`${S}.lowStock.title`)}>
        <SwitchRow
          id="low-stock-enabled"
          label={t(`${S}.lowStock.enabled`)}
          hint={t(`${S}.lowStock.enabledHint`)}
          checked={low.enabled}
          onChange={(enabled) => {
            onChange({ ...settings, low_stock: { ...low, enabled } })
          }}
        />
        {low.enabled ? (
          <CountField
            id="low-stock-threshold"
            label={t(`${S}.lowStock.threshold`)}
            hint={t(`${S}.lowStock.thresholdHint`)}
            value={low.threshold}
            min={LOW_STOCK_LIMITS.min}
            max={LOW_STOCK_LIMITS.max}
            error={problem(problems["low_stock.threshold"], LOW_STOCK_LIMITS.max)}
            onChange={(threshold) => {
              onChange({ ...settings, low_stock: { ...low, threshold } }, "low_stock.threshold")
            }}
          />
        ) : null}
      </PanelGroup>
      <PanelGroup title={t(`${S}.swatches.title`)} hint={t(`${S}.swatches.description`)}>
        <SwatchList
          swatches={settings.color_swatches}
          problems={problems}
          onChange={(color_swatches, field) => {
            onChange({ ...settings, color_swatches }, field)
          }}
        />
      </PanelGroup>
    </Panel>
  )
}
