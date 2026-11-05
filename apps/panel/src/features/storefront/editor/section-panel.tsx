import { Copy, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { AnySection, LayoutGroup, Placement } from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { isBodyGroup } from "@/features/storefront/layout/sections"
import { AnnouncementForm } from "./forms/announcement-form"
import { BannerForm } from "./forms/banner-form"
import { FaqForm } from "./forms/faq-form"
import { FeaturedForm } from "./forms/featured-form"
import { HeroForm } from "./forms/hero-form"
import { ProductsForm } from "./forms/products-form"
import { RelatedForm } from "./forms/related-form"
import { RichTextForm } from "./forms/rich-text-form"
import { ScheduleFields } from "./forms/schedule-fields"
import { Panel, PanelGroup } from "./panel-header"
import {
  BrandsForm,
  CategoriesForm,
  CountedForm,
  TrustBadgesForm,
  WordedForm,
} from "./forms/simple-forms"
import { SECTION_ICONS, kindOf } from "./section-meta"

const P = "storefront.editor.panel"

interface SectionPanelProps {
  section: AnySection
  group: LayoutGroup
  problems: SectionProblems
  /** May another of it be added (a page's section under its page's limit). */
  canDuplicate: boolean
  onChange: (section: AnySection, field?: string) => void
  /** A category page's section to the other side of its products. */
  onPlace: (placement: Placement) => void
  onBack: () => void
  onDuplicate: () => void
  onRemove: () => void
}

/** The form for one section type. */
function FormOf({
  section,
  problems,
  onChange,
}: Pick<SectionPanelProps, "section" | "problems" | "onChange">) {
  const props = { problems, onChange }
  switch (section.type) {
    case "announcement_bar":
      return <AnnouncementForm section={section} {...props} />
    case "hero":
      return <HeroForm section={section} {...props} />
    case "banner":
      return <BannerForm section={section} {...props} />
    case "categories":
      return <CategoriesForm section={section} {...props} />
    case "products":
      return <ProductsForm section={section} {...props} />
    case "featured_product":
      return <FeaturedForm section={section} {...props} />
    case "brands":
      return <BrandsForm section={section} {...props} />
    case "posts":
    case "reviews":
      return <CountedForm section={section} {...props} />
    case "rich_text":
      return <RichTextForm section={section} {...props} />
    case "faq":
      return <FaqForm section={section} {...props} />
    case "related_products":
      return <RelatedForm section={section} {...props} />
    case "trust_badges":
      return <TrustBadgesForm />
    case "newsletter":
    case "help":
      return <WordedForm section={section} {...props} />
  }
}

/**
 * A section's settings in their own column, as Shopify's editor opens
 * them: the way back to the page's parts, what the section is, its fields
 * in groups that fold away (where it sits on a category page, its own
 * fields, when it shows), then the section copied or taken off (both
 * undone with "Geri al").
 */
export function SectionPanel({
  section,
  group,
  problems,
  canDuplicate,
  onChange,
  onPlace,
  onBack,
  onDuplicate,
  onRemove,
}: SectionPanelProps) {
  const { t } = useTranslation()
  const kind = kindOf(section, group === "footer")
  const name = t(`storefront.editor.types.${kind}.name`)
  return (
    <Panel icon={SECTION_ICONS[kind]} title={name} onBack={onBack}>
      <p className="border-b px-5 py-4 text-[13px] leading-5 text-muted-foreground">
        {t(`storefront.editor.types.${kind}.description`)}
      </p>
      {"placement" in section ? (
        <PanelGroup title={t(`${P}.placement`)}>
          <RadioGroup
            aria-label={t(`${P}.placement`)}
            value={section.placement}
            className="gap-3"
            onValueChange={(next) => {
              onPlace(next as Placement)
            }}
          >
            {(["top", "bottom"] as const).map((placement) => (
              <label key={placement} className="flex items-center gap-2 text-sm">
                <RadioGroupItem value={placement} />
                {t(`storefront.editor.tree.placements.${placement}`)}
              </label>
            ))}
          </RadioGroup>
        </PanelGroup>
      ) : null}
      <PanelGroup title={t(`${P}.content`)}>
        <FormOf section={section} problems={problems} onChange={onChange} />
      </PanelGroup>
      <PanelGroup title={t(`${P}.visibility`)}>
        <ScheduleFields section={section} problem={problems["schedule"]} onChange={onChange} />
      </PanelGroup>
      <div className="flex flex-wrap gap-2 border-t px-5 py-4">
        {isBodyGroup(group) ? (
          <Button type="button" variant="outline" disabled={!canDuplicate} onClick={onDuplicate}>
            <Copy />
            {t(`${P}.duplicate`)}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" className="text-destructive-text" onClick={onRemove}>
          <Trash2 />
          {t(`${P}.remove`)}
        </Button>
      </div>
    </Panel>
  )
}
