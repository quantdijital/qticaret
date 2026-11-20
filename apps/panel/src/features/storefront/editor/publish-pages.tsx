import { useTranslation } from "react-i18next"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import type { ContentPageOption } from "./use-content-pages"

const E = "storefront.editor.publish"

/**
 * The content pages in draft the design lays out (`useDraftPages`), each
 * with "Sayfayı da yayına al" (adr/0073 Ek 2026-11-19 (2) K5); the page
 * being edited ticked first.
 */
export function PublishPages({
  pages,
  chosen,
  onChange,
}: {
  pages: readonly ContentPageOption[]
  chosen: ReadonlySet<string>
  onChange: (chosen: Set<string>) => void
}) {
  const { t } = useTranslation()
  if (pages.length === 0) {
    return null
  }
  return (
    <fieldset className="flex flex-col gap-2 rounded-md border p-3">
      <legend className="px-1 text-xs text-muted-foreground">{t(`${E}.pages`)}</legend>
      {pages.map((page) => {
        const id = `publish-page-${page.id}`
        return (
          <div key={page.id} className="flex items-start gap-2">
            <Checkbox
              id={id}
              checked={chosen.has(page.id)}
              onCheckedChange={(checked) => {
                const next = new Set(chosen)
                if (checked === true) {
                  next.add(page.id)
                } else {
                  next.delete(page.id)
                }
                onChange(next)
              }}
            />
            <label htmlFor={id} className="flex min-w-0 flex-col text-sm">
              <span>{t(`${E}.pageLive`, { title: page.title })}</span>
              <span className="truncate font-mono text-xs text-muted-foreground">{page.path}</span>
            </label>
          </div>
        )
      })}
    </fieldset>
  )
}
