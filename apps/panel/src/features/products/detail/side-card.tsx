import { Pencil } from "lucide-react"
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
 * sayfası"): what is saved, a fact to a line, and "Düzenle" opening its
 * dialog. The advisor's findings for it are counted under the facts; its
 * "Alana git" lands on the card (`id`) and opens the dialog.
 */
export function SideCard({
  id,
  title,
  rows,
  note,
  findings,
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
  onEdit: () => void
  disabled?: boolean
  /** Its dialog. */
  children?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div id={id} className="flex min-w-0 scroll-mt-20 flex-col">
      {/* SectionCard's look; the title and "Düzenle" stay on one line in the narrow column */}
      <section className="flex min-w-0 flex-col rounded-lg border bg-card text-card-foreground shadow-card">
        <header className="flex min-h-14 items-center justify-between gap-3 px-5 pt-4 pb-3">
          <h2 className="min-w-0 text-[15px] leading-6 font-semibold">{title}</h2>
          <Button
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
        </header>
        <div className="flex min-w-0 flex-col px-5 pb-5">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 text-[13px]">
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
            <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
              {note}
              {note && findings ? " · " : null}
              {findings ? <span className="text-warning-text">{findings}</span> : null}
            </p>
          ) : null}
        </div>
      </section>
      {children}
    </div>
  )
}
