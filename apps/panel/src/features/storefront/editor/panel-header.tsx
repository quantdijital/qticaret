import { ArrowLeft, ChevronDown, PanelLeft } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useContext, useId, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { EditorChromeContext } from "./editor-layout"

const P = "storefront.editor.panel"

/**
 * A settings panel (a section's, or the theme's), named by its title: its
 * header held at the top while it scrolls, with the way to the page's
 * parts (back to the list beside it, or its drawer where the list is
 * folded away). The groups' titles stick right under the header.
 */
export function Panel({
  icon: Icon,
  title,
  onBack,
  children,
}: {
  icon?: LucideIcon
  title: string
  onBack: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const { openSections } = useContext(EditorChromeContext)
  const id = useId()
  return (
    <div
      role="region"
      aria-labelledby={id}
      // A field the settings search picked is marked for a moment (`use-field-focus.ts`)
      className="flex flex-col [--editor-panel-head:3.25rem] [&_[data-highlight]]:rounded-md [&_[data-highlight]]:ring-2 [&_[data-highlight]]:ring-ring [&_[data-highlight]]:ring-offset-4 [&_[data-highlight]]:ring-offset-card"
    >
      <div className="sticky top-0 z-10 flex h-[var(--editor-panel-head)] shrink-0 items-center gap-2 border-b bg-card px-3">
        {openSections ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-haspopup="dialog"
            onClick={openSections}
          >
            <PanelLeft />
            {t(`${P}.sections`)}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t(`${P}.back`)}
            title={t(`${P}.back`)}
            onClick={onBack}
          >
            <ArrowLeft />
          </Button>
        )}
        {Icon ? (
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : null}
        <h2 id={id} className="min-w-0 flex-1 truncate text-sm font-semibold">
          {title}
        </h2>
      </div>
      {children}
    </div>
  )
}

/**
 * A group of a panel's fields that folds away: its title held under the
 * panel's header while its fields scroll past, open at first unless it is
 * the "fine settings" kind (`defaultOpen`). `reveal` opens it each time it
 * changes: the settings search found a field in it.
 */
export function PanelGroup({
  title,
  hint,
  children,
  className,
  defaultOpen = true,
  reveal = null,
}: {
  title: string
  hint?: string | undefined
  children: ReactNode
  className?: string
  defaultOpen?: boolean
  reveal?: number | null
}) {
  const [open, setOpen] = useState(defaultOpen || reveal !== null)
  const [revealed, setRevealed] = useState(reveal)
  if (reveal !== revealed) {
    setRevealed(reveal)
    if (reveal !== null) {
      setOpen(true)
    }
  }
  const id = useId()
  return (
    <div role="group" aria-labelledby={`${id}-title`} className="border-b last:border-b-0">
      <h3 id={`${id}-title`} className="sticky top-[var(--editor-panel-head)] z-[5] bg-card">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => {
            setOpen((was) => !was)
          }}
          className="flex h-11 w-full items-center justify-between gap-2 px-5 text-left text-sm font-semibold hover:bg-muted/60"
        >
          {title}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </h3>
      <div
        id={`${id}-body`}
        hidden={!open}
        className={cn("@container flex flex-col gap-5 px-5 pt-1 pb-6", className)}
      >
        {hint ? <p className="-mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        {children}
      </div>
    </div>
  )
}
