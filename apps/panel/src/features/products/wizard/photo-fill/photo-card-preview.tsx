import { useTranslation } from "react-i18next"
import type { AttributeDefinition } from "@/features/attributes/types"
import type { ProductCard, ProductCardValue } from "@/features/ai/product-card"

const P = "products.wizard.photo"

export interface PhotoCardPreviewProps {
  card: ProductCard
  /** The category's name in the shop; null when the card names none the form knows. */
  categoryName: string | null
  /** The chosen template's product attributes: the only ones shown, as the form will take them. */
  definitions: readonly AttributeDefinition[]
}

/**
 * The card's fields before "Kullan" (docs/22 "Aşama 6"): what goes into
 * which field, as plain text. An attribute shows by its label and its
 * options' labels; one the template does not define is not shown.
 */
export function PhotoCardPreview({ card, categoryName, definitions }: PhotoCardPreviewProps) {
  const { t } = useTranslation()
  const shown = (definition: AttributeDefinition, value: ProductCardValue): string => {
    const label = (each: string) =>
      definition.options?.find((option) => option.value === each)?.label ?? each
    if (typeof value === "boolean") {
      return t(value ? `${P}.yes` : `${P}.no`)
    }
    if (Array.isArray(value)) {
      return value.map(label).join(", ")
    }
    const text = typeof value === "number" ? String(value) : label(value)
    return definition.unit ? `${text} ${definition.unit}` : text
  }
  const attributes = definitions.flatMap((definition) => {
    const value = Object.hasOwn(card.attributes, definition.key)
      ? card.attributes[definition.key]
      : undefined
    return value === undefined ? [] : [{ definition, text: shown(definition, value) }]
  })
  return (
    <dl className="flex flex-col gap-2" data-slot="photo-card-preview">
      <div>
        <dt className="text-xs text-muted-foreground">{t(`${P}.fields.title`)}</dt>
        <dd className="font-medium">{card.title}</dd>
      </div>
      {card.short_description ? (
        <div>
          <dt className="text-xs text-muted-foreground">{t(`${P}.fields.summary`)}</dt>
          <dd className="whitespace-pre-line">{card.short_description}</dd>
        </div>
      ) : null}
      <div>
        <dt className="text-xs text-muted-foreground">{t(`${P}.fields.category`)}</dt>
        <dd>{categoryName ?? t(`${P}.noCategory`)}</dd>
      </div>
      {attributes.length > 0 ? (
        <div>
          <dt className="text-xs text-muted-foreground">{t(`${P}.fields.attributes`)}</dt>
          <dd>
            <ul className="flex flex-col gap-0.5">
              {attributes.map(({ definition, text }) => (
                <li key={definition.key}>
                  <span className="text-muted-foreground">{definition.label}:</span> {text}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      ) : null}
    </dl>
  )
}
