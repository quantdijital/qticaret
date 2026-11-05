import { Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CardFormProps {
  title: string
  description?: string
  /** Right of the title: an action of its own, apart from the card's save. */
  action?: ReactNode
  className?: string | undefined
  dirty: boolean
  saving: boolean
  onSubmit: () => void
  onReset: () => void
  children: ReactNode
}

/**
 * A section of the product page that saves on its own: its save and undo
 * buttons appear once something in it changes (docs/06 §6, one card one
 * save), so an edit never waits on the rest of the page.
 */
export function CardForm({
  title,
  description,
  action,
  className,
  dirty,
  saving,
  onSubmit,
  onReset,
  children,
}: CardFormProps) {
  const { t } = useTranslation()
  return (
    <SectionCard
      title={title}
      {...(description ? { description } : {})}
      action={action}
      className={className}
    >
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        {children}
        <div
          className={cn(
            "flex items-center justify-end gap-2 border-t pt-4",
            dirty || saving ? "" : "hidden"
          )}
        >
          <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={onReset}>
            {t("common.reset")}
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            {t("common.save")}
          </Button>
        </div>
      </form>
    </SectionCard>
  )
}
