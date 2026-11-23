import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { EmptyLine } from "@/features/settings/components/storefront-rows"
import type { CategoriesSection } from "@/features/storefront/api/layout"
import type { CategoriesIconsFields } from "@/features/storefront/api/layout-cards"
import { IconSelect } from "../shared/icon-select"
import { iconsFor } from "./icon-registry"
import { useRecordNames } from "./record-names"

const C = "storefront.editor.categoryIcons"

type IconRow = CategoriesSection & CategoriesIconsFields

/**
 * The icon row's content (adr/0077 §10 Ek): beside each category the shop
 * named, the icon its disc shows, picked from the sections' set; none, the
 * category's picture, else its first letter. Picked here, never on the
 * category. With no category named the row shows the top categories, each
 * with its picture or letter, and there is nothing to pick.
 */
export function CategoryIconsField({
  section,
  onChange,
}: {
  section: IconRow
  onChange: (section: IconRow, field?: string) => void
}) {
  const { t } = useTranslation()
  const names = useRecordNames("category", section.category_ids)
  const nameOf = (id: string) =>
    names.data?.[id] ??
    (names.isPending ? t("common.loading") : t("storefront.editor.records.missing"))
  return (
    <Field label={t(`${C}.icons`)} hint={t(`${C}.iconsHint`)}>
      {section.category_ids.length === 0 ? (
        <EmptyLine text={t(`${C}.iconsEmpty`)} />
      ) : (
        <ul aria-label={t(`${C}.icons`)} className="flex flex-col gap-2">
          {section.category_ids.map((id) => (
            <li key={id} className="flex items-center gap-2">
              <span className="w-28 min-w-0 shrink-0 truncate text-sm">{nameOf(id)}</span>
              <IconSelect
                id={`${section.id}-icon-${id}`}
                label={t(`${C}.iconOf`, { name: nameOf(id) })}
                value={section.category_icons[id]}
                noneLabel={t(`${C}.noIcon`)}
                onChange={(icon) => {
                  const rest = iconsFor(
                    section.category_ids.filter((each) => each !== id),
                    section.category_icons
                  )
                  onChange(
                    { ...section, category_icons: icon ? { ...rest, [id]: icon } : rest },
                    "category_icons"
                  )
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </Field>
  )
}
