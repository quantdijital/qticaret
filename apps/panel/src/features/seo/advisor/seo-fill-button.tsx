import { useQuery } from "@tanstack/react-query"
import { Sparkles } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { aiServicesQuery } from "@/features/ai/api/ai"
import { seoFillCountQuery } from "@/features/seo/api/seo-fill"
import { SeoFillDialog } from "@/features/seo/advisor/seo-fill-dialog"

const TASK = "seo_title"

/**
 * "Eksik metaları yapay zekâ ile doldur (N)" on the advisor's card
 * (adr/0074 §5 madde 7): the count is the pages one job takes. Drawn only
 * for a role the search text tasks allow; it opens the dialog where the
 * job starts and its suggestions are reviewed.
 */
export function SeoFillButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const services = useQuery(aiServicesQuery())
  const view = services.data?.tasks.find((each) => each.id === TASK)
  const allowed = view?.allowed === true
  const count = useQuery({ ...seoFillCountQuery(), enabled: allowed })
  if (!allowed) {
    return null
  }
  const usable = view.usable
  const remembered = view.preference && usable.includes(view.preference) ? view.preference : null
  const pages = count.data ? Math.min(count.data.pages, count.data.max) : 0
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true)
        }}
      >
        <Sparkles />
        {t("seo.aiFill.open", { count: pages })}
      </Button>
      <SeoFillDialog open={open} onOpenChange={setOpen} usable={usable} remembered={remembered} />
    </>
  )
}
