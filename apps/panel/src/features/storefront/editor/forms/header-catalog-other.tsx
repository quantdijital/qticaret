import { useTranslation } from "react-i18next"
import type { HeaderCatalogSection } from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { HEADER_CATALOG_DEFAULTS } from "@/features/storefront/layout/variants"
import { PanelGroup } from "../panel-header"
import { headerCatalogIn } from "./field-registry"
import { HeaderCatalogFields } from "./header-catalog-fields"

/**
 * The catalog header's finer settings (adr/0049 Ek 2026-11-15): the
 * written search button, the written account link and the cart's
 * subtotal, closed in "Diğer ayarlar", its title counting the ones set.
 */
export function HeaderCatalogOther({
  section,
  problems,
  reveal,
  onChange,
}: {
  section: HeaderCatalogSection
  problems: SectionProblems
  reveal: number | null
  onChange: (section: HeaderCatalogSection, field?: string) => void
}) {
  const { t } = useTranslation()
  const set = headerCatalogIn("look").filter(
    (field) => section[field] !== HEADER_CATALOG_DEFAULTS[field]
  ).length
  return (
    <PanelGroup
      title={
        set > 0
          ? t("storefront.editor.look.titleSet", { count: set })
          : t("storefront.editor.look.title")
      }
      hint={t("storefront.editor.headerBar.otherHint")}
      defaultOpen={false}
      reveal={reveal}
    >
      <HeaderCatalogFields section={section} group="look" problems={problems} onChange={onChange} />
    </PanelGroup>
  )
}
