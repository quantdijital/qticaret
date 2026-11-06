import { Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ListFooter, RowCell } from "@/features/settings/components/storefront-rows"
import { STOREFRONT_LIMITS as L, isHexColor } from "@/features/settings/storefront"
import type { LayoutSettings } from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { STOREFRONT_THEME_COLOR } from "@/theme/storefront"
import { useProblemText } from "../forms/problem-text"

const C = "storefront.editor.shared.swatches"
// A new row starts on the theme's near-black, so its picker and its code agree from the start
const START_COLOR = STOREFRONT_THEME_COLOR

type Swatch = LayoutSettings["color_swatches"][number]

interface SwatchListProps {
  swatches: Swatch[]
  problems: SectionProblems
  onChange: (swatches: Swatch[], field?: string) => void
}

/**
 * The shop's colour names (F18 D5): a product option or a filter value that
 * reads as one of them, in any case, shows as a coloured circle. Each row:
 * the circle as the storefront draws it, the name, the picker and the code.
 */
export function SwatchList({ swatches, problems, onChange }: SwatchListProps) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const setOne = (index: number, change: Partial<Swatch>, field: string) => {
    onChange(
      swatches.map((swatch, at) => (at === index ? { ...swatch, ...change } : swatch)),
      field
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {swatches.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {swatches.map((swatch, index) => {
            const number = index + 1
            const id = `swatch-${String(index)}`
            const at = `color_swatches.${String(index)}`
            const valid = isHexColor(swatch.hex)
            const labelError = problem(problems[`${at}.label`], L.swatchLabelLength)
            const hexError = problem(problems[`${at}.hex`])
            return (
              <li
                key={index}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2"
              >
                <span aria-hidden className="flex h-9 items-center">
                  <span
                    className="size-6 rounded-full border"
                    style={valid ? { backgroundColor: swatch.hex } : undefined}
                  />
                </span>
                <RowCell error={labelError} errorId={`${id}-label-error`}>
                  <Input
                    value={swatch.label}
                    maxLength={L.swatchLabelLength}
                    aria-label={t(`${C}.labelOf`, { number })}
                    aria-invalid={Boolean(labelError)}
                    aria-describedby={labelError ? `${id}-label-error` : undefined}
                    placeholder={t(`${C}.labelPlaceholder`)}
                    autoComplete="off"
                    onChange={(event) => {
                      setOne(index, { label: event.target.value }, `${at}.label`)
                    }}
                  />
                </RowCell>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive-text"
                  aria-label={t("settings.storefront.remove", {
                    item: t(`${C}.item`, { number }),
                  })}
                  onClick={() => {
                    onChange(swatches.filter((_, other) => other !== index))
                  }}
                >
                  <Trash2 />
                </Button>
                <RowCell
                  error={hexError}
                  errorId={`${id}-hex-error`}
                  className="col-span-2 col-start-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={t(`${C}.pickerOf`, { number })}
                      // A half-typed code shows the picker on the start colour until it is whole
                      value={valid ? swatch.hex : START_COLOR}
                      onChange={(event) => {
                        setOne(index, { hex: event.target.value }, `${at}.hex`)
                      }}
                      className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
                    />
                    <Input
                      value={swatch.hex}
                      aria-label={t(`${C}.hexOf`, { number })}
                      aria-invalid={Boolean(hexError)}
                      aria-describedby={hexError ? `${id}-hex-error` : undefined}
                      placeholder={t(`${C}.hexPlaceholder`)}
                      autoComplete="off"
                      spellCheck={false}
                      className="min-w-0 flex-1 font-mono"
                      onChange={(event) => {
                        setOne(index, { hex: event.target.value.trim().toLowerCase() }, `${at}.hex`)
                      }}
                    />
                  </div>
                </RowCell>
              </li>
            )
          })}
        </ol>
      ) : null}
      <ListFooter
        label={t(`${C}.add`)}
        hint={t(`${C}.hint`, { max: L.colorSwatches, length: L.swatchLabelLength })}
        full={swatches.length >= L.colorSwatches}
        onAdd={() => {
          onChange([...swatches, { label: "", hex: START_COLOR }])
        }}
      />
    </div>
  )
}
