import { Copy, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { ADDON_LIMITS } from "@/features/products/api/addons"

const A = "products.addons"

/** Under the product's add-ons: a new one (none past five), another product's copied, the limit. */
export function AddonToolbar({
  full,
  onAdd,
  onCopy,
}: {
  full: boolean
  onAdd: () => void
  onCopy: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button type="button" size="sm" variant="outline" disabled={full} onClick={onAdd}>
        <Plus />
        {t(`${A}.add`)}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onCopy}>
        <Copy />
        {t(`${A}.copy.action`)}
      </Button>
      <span className="text-xs text-muted-foreground">
        {t(`${A}.limit`, { max: ADDON_LIMITS.addons })}
      </span>
    </div>
  )
}
