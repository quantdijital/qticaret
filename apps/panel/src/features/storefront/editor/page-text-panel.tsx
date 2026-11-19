import { Link } from "@tanstack/react-router"
import { FileText, Mail, SquarePen } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Panel } from "./panel-header"

const C = "storefront.editor.contentPage.text"

/**
 * A content page's own text, the fixed row between its sections (adr/0073
 * §5): not a section and not the design's. Its title, cover, text and
 * search appearance are written in İçerik; on the contact page, the
 * contact details and the form stand with it (Vitrin tercihleri).
 */
export function PageTextPanel({
  pageId,
  contact,
  onBack,
}: {
  pageId: string
  contact: boolean
  onBack: () => void
}) {
  const { t } = useTranslation()
  const which = contact ? "contact" : "page"
  return (
    <Panel icon={contact ? Mail : FileText} title={t(`${C}.${which}`)} onBack={onBack}>
      <div className="flex flex-col gap-4 px-5 py-4">
        <p className="text-[13px] leading-5 text-muted-foreground">{t(`${C}.about.${which}`)}</p>
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link to="/content/$id" params={{ id: pageId }}>
            <SquarePen />
            {t(`${C}.edit`)}
          </Link>
        </Button>
      </div>
    </Panel>
  )
}
