import { Link2, Pencil, Plus, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Badge } from "@qticaret/admin-ui/ui/badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import type { LayoutLink } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS } from "@/features/storefront/api/layout"
import { useLinkName } from "./record-names"
import { useLinkPicker } from "./use-link-picker"

const L = "storefront.editor.link"

interface LinkCardProps {
  id: string
  link: LayoutLink
  /** The link with new wording; `field` is "label" while it is typed. */
  onChange: (link: LayoutLink, field?: "label") => void
  onEdit: () => void
  /** Move and remove buttons, or a remove button of its own. */
  actions?: ReactNode
  onRemove?: () => void
  error?: string | undefined
}

/** A link: where it points, its wording (the record's name when none), and a way to change it. */
export function LinkCard({ id, link, onChange, onEdit, actions, onRemove, error }: LinkCardProps) {
  const { t } = useTranslation()
  const name = useLinkName(link)
  const fallback = name ?? t(`${L}.missing`)
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="shrink-0 font-normal">
          {t(`storefront.menus.kinds.${link.kind}`)}
        </Badge>
        <span className="min-w-0 flex-1 truncate text-sm">{fallback}</span>
        {actions}
      </div>
      <Input
        id={id}
        value={link.label ?? ""}
        maxLength={LAYOUT_LIMITS.label}
        placeholder={link.kind === "url" ? t(`${L}.labelRequired`) : fallback}
        aria-label={t(`${L}.label`, { name: fallback })}
        aria-invalid={Boolean(error)}
        onChange={(event) => {
          const label = event.target.value
          onChange(
            link.kind === "url"
              ? { ...link, label }
              : { ...link, label: label.trim() === "" ? null : label },
            "label"
          )
        }}
      />
      {error ? (
        <p role="alert" className="text-xs text-destructive-text">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onEdit}>
          <Pencil />
          {t(`${L}.change`)}
        </Button>
        {onRemove ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive-text"
            onClick={onRemove}
          >
            <Trash2 />
            {t(`${L}.remove`)}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

interface LinkFieldProps {
  id: string
  label: string
  /** The technical term shown small beside the label. */
  term?: string | undefined
  hint?: string | undefined
  link: LayoutLink | null
  onChange: (link: LayoutLink | null, field?: "label") => void
  error?: string | undefined
}

/** One optional link (a slide's, a list's "see all"): picked, reworded, or taken off. */
export function LinkField({ id, label, term, hint, link, onChange, error }: LinkFieldProps) {
  const { t } = useTranslation()
  const picker = useLinkPicker((next) => {
    onChange(next)
  })
  return (
    <Field label={label} term={term} hint={hint} {...(link ? { htmlFor: id } : {})}>
      {link ? (
        <LinkCard
          id={id}
          link={link}
          error={error}
          onChange={onChange}
          onEdit={() => {
            picker.open(link)
          }}
          onRemove={() => {
            onChange(null)
          }}
        />
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => {
            picker.open(null)
          }}
        >
          <Link2 />
          {t(`${L}.choose`)}
        </Button>
      )}
      {picker.dialog}
    </Field>
  )
}

/** Add-a-link button for a list of links (the hero's buttons). */
export function AddLinkButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onClick}>
      <Plus />
      {label}
    </Button>
  )
}
