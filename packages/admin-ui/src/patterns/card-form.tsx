import { Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { CollapsibleSection } from "./collapsible-section"
import type { CollapseOptions } from "./collapsible-section"
import { useDirtyEntry } from "./dirty-registry"
import { SectionCard } from "./section-card"
import { Button } from "../ui/button"
import { cn } from "../lib/utils"

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
  /** Folds to its title and a one-line summary (a page's secondary parts, docs/18 §7). */
  collapse?: CollapseOptions | undefined
  /**
   * No card around it, inside a frame that already titles it (the theme
   * editor's panel groups); the title names the form for screen readers.
   */
  bare?: boolean
  /**
   * The form fills the card when a row stretches it (`PageGrid`), so a
   * closing part of its own (`mt-auto`) sits at the card's foot.
   */
  fill?: boolean
  children: ReactNode
}

/**
 * A section of the product page that saves on its own: its save and undo
 * buttons appear once something in it changes (docs/06 §6, one card one
 * save), so an edit never waits on the rest of the page. With `collapse`
 * it folds to a line; closed, an unsaved edit stays and its header says so.
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
  collapse,
  bare = false,
  fill = false,
  children,
}: CardFormProps) {
  const { t } = useTranslation(ADMIN_UI_NS)
  // On a page with one header save, its changes are saved or let go there too
  useDirtyEntry({ dirty, saving, submit: onSubmit, reset: onReset })
  const form = (
    <form
      noValidate
      aria-label={bare ? title : undefined}
      className={cn("flex flex-col gap-5", fill && "flex-1")}
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
  )
  if (bare) {
    return form
  }
  return collapse ? (
    <CollapsibleSection
      {...collapse}
      title={title}
      description={description}
      action={action}
      dirty={dirty}
      className={className}
    >
      {form}
    </CollapsibleSection>
  ) : (
    <SectionCard
      title={title}
      {...(description ? { description } : {})}
      action={action}
      className={className}
    >
      {form}
    </SectionCard>
  )
}
