import { useTranslation } from "react-i18next"
import { StepChoice } from "./step-choice"

/** A column count drawn in small: that many cards in a row. */
export const ColumnsDrawing = ({ count }: { count: number }) => (
  <span aria-hidden="true" className="flex w-full max-w-12 gap-0.5">
    {Array.from({ length: count }, (_, index) => (
      <span key={index} className="h-3 flex-1 rounded-sm bg-current opacity-40" />
    ))}
  </span>
)

/**
 * Cards in a row on a phone (docs/tema/bilesen-denetimi (b) 3, O8; the
 * dictionary's `columns_mobile`): one or two side by side, each drawn in
 * small, "Varsayılana dön" once changed. A product grid's default is two,
 * the linked category cards' one: the look before the setting.
 */
export function PhoneColumnsField<T extends 1 | 2>({
  id,
  value,
  fallback,
  hint,
  onChange,
}: {
  id: string
  value: T
  fallback: T
  /** What the setting does for this section; none: the products' words. */
  hint?: string | undefined
  onChange: (value: T) => void
}) {
  const { t } = useTranslation()
  const F = "storefront.editor.fields"
  return (
    <StepChoice
      id={id}
      label={t(`${F}.columnsMobile`)}
      term={t(`${F}.columnsMobileTerm`)}
      hint={hint ?? t(`${F}.columnsMobileHint`)}
      steps={[1, 2] as T[]}
      value={value}
      fallback={fallback}
      nameOf={(count) => t(`${F}.columnsMobileOption`, { count })}
      drawOf={(count) => <ColumnsDrawing count={count} />}
      onChange={onChange}
    />
  )
}
