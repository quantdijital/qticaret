import { useQuery } from "@tanstack/react-query"
import { LayoutList, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { useRecordWalk } from "@qticaret/admin-ui/hooks/use-record-walk"
import { Button } from "@qticaret/admin-ui/ui/button"
import { templatesQuery } from "@/features/attributes/api"
import { TemplateDialog } from "@/features/attributes/components/template-dialog"
import { errorText } from "@/lib/errors"

/**
 * Settings > Product attributes (adr/0013): templates that say which
 * attributes a kind of product carries. Sector needs live here as data,
 * never as code (CLAUDE.md).
 */
export function AttributesPage() {
  const { t } = useTranslation()
  const query = useQuery(templatesQuery())
  const walk = useRecordWalk(query.data, (template) => template.id)
  const [creating, setCreating] = useState(false)
  const add = (
    <Button
      onClick={() => {
        setCreating(true)
      }}
    >
      <Plus />
      {t("attributes.createTemplate")}
    </Button>
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("attributes.title")}
        description={t("attributes.subtitle")}
        action={add}
      />
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingRows rows={4} />
      ) : query.data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
          <LayoutList className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-md text-sm text-muted-foreground">{t("attributes.empty")}</p>
          {add}
        </div>
      ) : (
        <ul className="grid gap-[var(--grid-gap)] md:grid-cols-2">
          {query.data.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => {
                  walk.show(template)
                }}
                className="flex w-full flex-col gap-3 rounded-lg border bg-card p-5 text-left shadow-card transition-colors hover:border-input"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{template.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("attributes.count", { count: template.definitions.length })}
                  </span>
                </span>
                {template.description ? (
                  <span className="line-clamp-2 text-[13px] text-muted-foreground">
                    {template.description}
                  </span>
                ) : null}
                <span className="flex flex-wrap gap-1.5">
                  {[...template.definitions]
                    .sort((a, b) => a.rank - b.rank)
                    .slice(0, 8)
                    .map((definition) => (
                      <span key={definition.id} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                        {definition.label}
                      </span>
                    ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {walk.open ? (
        <TemplateDialog
          template={walk.open}
          steps={walk.steps}
          templateAt={(index) => query.data?.[index]}
          onClose={walk.close}
        />
      ) : null}
      {creating ? (
        <TemplateDialog
          template={null}
          onClose={() => {
            setCreating(false)
          }}
        />
      ) : null}
    </div>
  )
}
