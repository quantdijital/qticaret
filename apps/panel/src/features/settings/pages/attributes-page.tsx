import { useQuery } from "@tanstack/react-query"
import { LayoutList, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { useRecordWalk } from "@qticaret/admin-ui/hooks/use-record-walk"
import { Button } from "@qticaret/admin-ui/ui/button"
import { templatesQuery } from "@/features/attributes/api"
import { ADDONS_FLAG } from "@/features/products/api/addons"
import { useFeatureState } from "@/features/settings/api/features"
import { AddonTemplatesSection } from "@/features/products/addon-templates/addon-templates-section"
import { TemplateDialog } from "@/features/attributes/components/template-dialog"
import { CatalogDefaultsCard } from "@/features/settings/components/catalog-defaults-card"
import { ProductBadgesCard } from "@/features/settings/components/product-badges-card"
import type { AttributeTemplate } from "@/features/attributes/types"
import { errorText } from "@/lib/errors"

const A = "attributes"

function useColumns(onOpen: (template: AttributeTemplate) => void): Column<AttributeTemplate>[] {
  const { t } = useTranslation()
  return [
    {
      key: "name",
      // Long names and attribute lists wrap onto new lines; the table never scrolls sideways
      className: "whitespace-normal",
      header: t(`${A}.columns.name`),
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
          {/* What it holds tells it apart better than any note */}
          {template.definitions.length > 0 || template.description ? (
            <span className="max-w-full text-xs text-muted-foreground wrap-anywhere">
              {template.definitions.length > 0
                ? [...template.definitions]
                    .sort((a, b) => a.rank - b.rank)
                    .map((definition) => definition.label)
                    .join(", ")
                : template.description}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "definitions",
      header: t(`${A}.columns.definitions`),
      align: "right",
      cell: (template) => (
        <span className="text-muted-foreground tabular-nums">
          {t(`${A}.count`, { count: template.definitions.length })}
        </span>
      ),
    },
  ]
}

/**
 * Settings > Product attributes (adr/0013): attribute groups (the API's
 * templates) that say which attributes a kind of product carries, one row
 * each with its attributes' names; a row opens its group. Add-on groups
 * follow below. Sector needs live here as data, never as code (CLAUDE.md).
 */
export function AttributesPage() {
  const { t } = useTranslation()
  const query = useQuery(templatesQuery())
  const walk = useRecordWalk(query.data, (template) => template.id)
  const columns = useColumns(walk.show)
  const [creating, setCreating] = useState(false)
  const addonsOn = useFeatureState(ADDONS_FLAG) === true
  const add = (
    <Button
      onClick={() => {
        setCreating(true)
      }}
    >
      <Plus />
      {t(`${A}.createTemplate`)}
    </Button>
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${A}.title`)} description={t(`${A}.subtitle`)} action={add} />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
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
            onRowClick={walk.show}
            empty={
              <div className="flex flex-col items-center gap-3 text-center">
                <LayoutList className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="max-w-md text-sm text-muted-foreground">{t(`${A}.empty`)}</p>
                {add}
              </div>
            }
          />
        )}
      </section>
      {/* adr/0052 Ek 2026-11-23: add-ons defined once, beside the attribute templates */}
      <AddonTemplatesSection />
      {/* adr/0076 §12: what a new product starts as, beside the attribute groups */}
      <CatalogDefaultsCard />
      {/* The small badge on a product card's photo, each kind on its own switch */}
      <ProductBadgesCard />
      {walk.open ? (
        <TemplateDialog
          template={walk.open}
          steps={walk.steps}
          templateAt={(index) => query.data?.[index]}
          onClose={walk.close}
          addonsOn={addonsOn}
        />
      ) : null}
      {creating ? (
        <TemplateDialog
          template={null}
          addonsOn={addonsOn}
          onClose={() => {
            setCreating(false)
          }}
        />
      ) : null}
    </div>
  )
}
