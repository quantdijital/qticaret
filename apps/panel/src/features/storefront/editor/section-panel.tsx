import { ArrowLeft, Copy, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import type { AnySection, LayoutGroup } from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { AnnouncementForm } from "./forms/announcement-form"
import { BannerForm } from "./forms/banner-form"
import { HeroForm } from "./forms/hero-form"
import { ProductsForm } from "./forms/products-form"
import { RichTextForm } from "./forms/rich-text-form"
import { ScheduleFields } from "./forms/schedule-fields"
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
  /** May another of it be added (a home section under the limit). */
  canDuplicate: boolean
  onChange: (section: AnySection, field?: string) => void
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
    case "brands":
      return <BrandsForm section={section} {...props} />
    case "posts":
    case "reviews":
      return <CountedForm section={section} {...props} />
    case "rich_text":
      return <RichTextForm section={section} {...props} />
    case "trust_badges":
      return <TrustBadgesForm />
    case "newsletter":
    case "help":
      return <WordedForm section={section} {...props} />
  }
}

/**
 * A section's settings in the side panel, as Shopify's editor opens them:
 * a way back to the list, the type's own fields, when it shows, and the
 * section copied or taken off (both undone with "Geri al").
 */
export function SectionPanel({
  section,
  group,
  problems,
  canDuplicate,
  onChange,
  onBack,
  onDuplicate,
  onRemove,
}: SectionPanelProps) {
  const { t } = useTranslation()
  const kind = kindOf(section, group === "footer")
  const Icon = SECTION_ICONS[kind]
  const name = t(`storefront.editor.types.${kind}.name`)
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-card px-2 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t(`${P}.back`)}
          onClick={onBack}
        >
          <ArrowLeft />
        </Button>
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</h2>
      </div>
      <div className="flex flex-col gap-6 p-4">
        <p className="text-xs text-muted-foreground">
          {t(`storefront.editor.types.${kind}.description`)}
        </p>
        <FormOf section={section} problems={problems} onChange={onChange} />
        <div className="border-t pt-5">
          <ScheduleFields section={section} problem={problems["schedule"]} onChange={onChange} />
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-5">
          {group === "home" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canDuplicate}
              onClick={onDuplicate}
            >
              <Copy />
              {t(`${P}.duplicate`)}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive-text"
            onClick={onRemove}
          >
            <Trash2 />
            {t(`${P}.remove`)}
          </Button>
        </div>
      </div>
    </div>
  )
}
