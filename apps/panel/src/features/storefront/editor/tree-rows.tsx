import { Link } from "@tanstack/react-router"
import { ChevronRight, CircleAlert, Plus } from "lucide-react"
import { useId } from "react"
import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"

/** The page tree's own rows (`SectionTree`): its groups, the frame's parts edited elsewhere, the theme's panels. */

export function TreeGroup({ title, children }: { title: string; children: ReactNode }) {
  // Named by its heading: a screen reader (and a test) can tell the header's rows from the page's
  const heading = useId()
  return (
    <div role="group" aria-labelledby={heading} className="flex flex-col gap-1">
      <h2
        id={heading}
        className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        {title}
      </h2>
      {children}
    </div>
  )
}

/** A part of the frame edited on another screen: its name and links there. */
export function ElsewhereRow({
  icon: Icon,
  name,
  links,
}: {
  icon: LucideIcon
  name: string
  links: { to: "/settings/store" | "/storefront/menus"; label: string }[]
}) {
  return (
    <li className="flex items-start gap-2 py-1.5 pr-2 pl-6">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm">{name}</span>
        <span className="flex flex-wrap gap-x-3 text-xs">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-primary-text underline-offset-4 hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </span>
      </div>
    </li>
  )
}

/** One of the theme's own panels: its settings, or a part every page shares. */
export function ThemeRow({
  icon: Icon,
  label,
  problem = false,
  onClick,
}: {
  icon: LucideIcon
  label: string
  problem?: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="w-full justify-start pl-6"
      onClick={onClick}
    >
      <Icon />
      <span className="flex-1 truncate text-left">{label}</span>
      {problem ? (
        <CircleAlert
          role="img"
          aria-label={t("storefront.editor.row.problem")}
          className="size-3.5 shrink-0 text-destructive-text"
        />
      ) : null}
      <ChevronRight className="text-muted-foreground" />
    </Button>
  )
}

/**
 * A button that adds what a group lacks (the header's bar or strip, the
 * footer's box); `full` says why it cannot be added now.
 */
export function AddRow({
  label,
  onClick,
  full = null,
}: {
  label: string
  onClick: () => void
  full?: string | null
}) {
  const note = useId()
  return (
    <li className="pl-5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start text-primary-text"
        disabled={full !== null}
        aria-describedby={full !== null ? note : undefined}
        onClick={onClick}
      >
        <Plus />
        {label}
      </Button>
      {full !== null ? (
        <p id={note} className="px-3 pb-1 text-xs text-muted-foreground">
          {full}
        </p>
      ) : null}
    </li>
  )
}
