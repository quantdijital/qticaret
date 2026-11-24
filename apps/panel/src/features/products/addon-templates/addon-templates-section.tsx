import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ListPlus, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { addonTemplatesQuery } from "@/features/products/api/addon-templates"
import type { AddonTemplate } from "@/features/products/api/addon-templates"
import { ADDONS_FLAG } from "@/features/products/api/addons"
import { featuresQuery, useFeatureState } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"
import { AddonTemplateCreateDialog } from "./addon-template-create-dialog"

const T = "products.addonTemplates"

function useColumns(onOpen: (template: AddonTemplate) => void): Column<AddonTemplate>[] {
  const { t } = useTranslation()
  return [
    {
      key: "name",
      // Long names and attribute lists wrap onto new lines; the table never scrolls sideways
      className: "whitespace-normal",
      header: t(`${T}.columns.name`),
      cell: (template) => (
        <div className="flex min-w-0 flex-col items-start">
          {/* The row opens it too; this is the keyboard's way in */}
          <button
            type="button"
            className="max-w-full text-left font-medium wrap-anywhere hover:underline"
            onClick={(event) => {
              event.stopPropagation()
              onOpen(template)
            }}
          >
            {template.name}
          </button>
          <span className="max-w-full text-xs text-muted-foreground wrap-anywhere">
            {template.addons.map((addon) => addon.label).join(", ")}
          </span>
        </div>
      ),
    },
    {
      key: "used",
      header: t(`${T}.columns.used`),
      align: "right",
      // On a phone the parts stack instead of widening the table; each stays whole
      className: "whitespace-normal",
      cell: (template) => (
        <span className="flex flex-wrap justify-end gap-x-1 text-muted-foreground tabular-nums">
          {[
            t(`${T}.productCount`, { count: template.product_count }),
            template.attribute_templates.length > 0
              ? t(`${T}.carriedCount`, { count: template.attribute_templates.length })
              : null,
          ]
            .filter((part): part is string => part !== null)
            .map((part, index) => (
              <span key={part} className="whitespace-nowrap">
                {index > 0 ? "· " : null}
                {part}
              </span>
            ))}
        </span>
      ),
    },
  ]
}

/**
 * Settings > Product attributes, below the attribute templates (adr/0052
 * Ek 2026-11-23): add-on templates, one row each; a row opens its
 * page. Shown while the shop's add-ons are on, or while any exist.
 */
export function AddonTemplatesSection() {
  const { t } = useTranslation()
  const query = useQuery(addonTemplatesQuery())
  const features = useQuery(featuresQuery())
  const state = useFeatureState(ADDONS_FLAG)
  const flagOn = features.isError ? false : state === true
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  // A row opens the template's own page: one window, never a dialog on a dialog
  const openTemplate = (template: AddonTemplate) => {
    void navigate({
      to: "/settings/attributes/addon-templates/$id",
      params: { id: template.id },
    })
  }
  const columns = useColumns(openTemplate)
  if (!flagOn && (query.data ?? []).length === 0) {
    return null
  }
  const add = flagOn ? (
    <Button
      variant="outline"
      onClick={() => {
        setCreating(true)
      }}
    >
      <Plus />
      {t(`${T}.create`)}
    </Button>
  ) : null
  return (
    <section
      aria-labelledby="addon-templates-title"
      className="overflow-hidden rounded-lg border bg-card shadow-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="addon-templates-title" className="text-base font-semibold">
            {t(`${T}.title`)}
          </h2>
          <p className="text-[13px] text-muted-foreground">{t(`${T}.subtitle`)}</p>
        </div>
        {add}
      </div>
      {query.isError ? (
        <div className="p-5">
          <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={query.data}
          rowKey={(template) => template.id}
          loading={query.isPending}
          onRowClick={openTemplate}
          empty={
            <div className="flex flex-col items-center gap-3 text-center">
              <ListPlus className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="max-w-md text-sm text-muted-foreground">{t(`${T}.empty`)}</p>
              {add}
            </div>
          }
        />
      )}
      {creating ? (
        <AddonTemplateCreateDialog
          onClose={() => {
            setCreating(false)
          }}
        />
      ) : null}
    </section>
  )
}
