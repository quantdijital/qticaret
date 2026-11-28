import { Pencil } from "lucide-react"
import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"

export interface SideRow {
  label: string
  value: ReactNode
  /** Said as missing (a category not chosen): muted, not a fact. */
  empty?: boolean
}

/**
 * A short card in the product page's narrow column (docs/06 "Ürün
 * sayfası"): what is saved, a fact to a line, and "Düzenle" turning the
 * card into its form in place (`editing`, `children`). The advisor's
 * findings for it are counted under the facts; its "Alana git" lands on
 * the card (`id`) and opens the form.
 */
export function SideCard({
  id,
  title,
  rows,
  note,
  findings,
  editing,
  onEdit,
  disabled = false,
  children,
}: {
  id: string
  title: string
  rows: readonly SideRow[]
  /** One line under the facts: what is used instead (the default parcel). */
  note?: string | undefined
  /** What the advisor found for it ("1 öneri"), under the facts. */
  findings?: string | undefined
  /** Its form is open in the card, in place of the facts. */
  editing: boolean
  onEdit: () => void
  disabled?: boolean
  /** Its form (`SideForm`), drawn while `editing`. */
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const edit = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(editing)
  // The form closed (saved or let go) with the focus in it: back to "Düzenle"
  useEffect(() => {
    const lost = document.activeElement === null || document.activeElement === document.body
    if (wasEditing.current && !editing && lost) {
      edit.current?.focus()
    }
    wasEditing.current = editing
  }, [editing])
  return (
    <div id={id} className="flex min-w-0 scroll-mt-20 flex-col">
      {/* SectionCard's look; the title and "Düzenle" stay on one line in the narrow column */}
      <section
        aria-label={title}
        className="@container flex min-w-0 flex-col rounded-lg border bg-card text-card-foreground shadow-card"
      >
        <header className="flex min-h-14 items-center justify-between gap-3 px-5 pt-4 pb-3">
          <h2 className="min-w-0 text-[15px] leading-6 font-semibold">{title}</h2>
          {editing ? null : (
            <Button
              ref={edit}
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={disabled}
              aria-label={t("products.side.editOf", { title })}
              onClick={onEdit}
            >
              <Pencil />
              {t("common.edit")}
            </Button>
          )}
        </header>
        <div className="flex min-w-0 flex-col px-5 pb-5">
          {editing ? (
            children
          ) : (
            <>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1.5 text-[13px]">
                {rows.map((row) => (
                  <div key={row.label} className="contents">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd
                      className={
                        row.empty
                          ? "text-right break-words text-muted-foreground"
                          : "text-right break-words"
                      }
                    >
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
              {note || findings ? (
                <p className="mt-2.5 border-t pt-2.5 text-xs text-muted-foreground">
                  {note}
                  {note && findings ? " · " : null}
                  {findings ? <span className="text-warning-text">{findings}</span> : null}
                </p>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
