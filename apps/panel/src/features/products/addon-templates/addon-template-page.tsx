import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { ListChecks, MoreHorizontal, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import { Input } from "@qticaret/admin-ui/ui/input"
import {
  addonTemplateQuery,
  useDeleteAddonTemplate,
  useSaveAddonTemplate,
} from "@/features/products/api/addon-templates"
import type { AddonTemplate } from "@/features/products/api/addon-templates"
import { ADDONS_FLAG, ADDON_LIMITS } from "@/features/products/api/addons"
import type { AddonsFailure } from "@/features/products/detail/addon-failure"
import { AddonNotice } from "@/features/products/detail/addon-notice"
import { featuresQuery, useFeatureState } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"
import { AddonTemplateAddonsCard } from "./addon-template-addons-card"
import { AddonTemplateApplyDialog } from "./addon-template-apply-dialog"
import { templateFailureOf } from "./template-failure"

const T = "products.addonTemplates"
const route = getRouteApi("/_auth/settings/attributes/addon-templates/$id")

function NameCard({ template, flagOn }: { template: AddonTemplate; flagOn: boolean }) {
  const { t } = useTranslation()
  const save = useSaveAddonTemplate()
  const [name, setName] = useState(template.name)
  const [failure, setFailure] = useState<AddonsFailure | null>(null)
  return (
    <CardForm
      title={t(`${T}.name`)}
      dirty={name !== template.name}
      saving={save.isPending}
      onSubmit={() => {
        save.mutate(
          { id: template.id, name: name.trim() },
          {
            onSuccess: () => {
              setFailure(null)
              toast.success(t(`${T}.saved`))
            },
            onError: (error) => {
              setFailure(templateFailureOf(t, error, flagOn))
            },
          }
        )
      }}
      onReset={() => {
        setFailure(null)
        setName(template.name)
      }}
    >
      <Field
        label={t(`${T}.name`)}
        htmlFor="addon-template-name"
        hint={t(`${T}.nameHint`, { max: ADDON_LIMITS.label })}
        required
      >
        <Input
          id="addon-template-name"
          value={name}
          maxLength={ADDON_LIMITS.label}
          onChange={(event) => {
            setName(event.target.value)
          }}
        />
      </Field>
      {failure ? <AddonNotice tone="danger" {...failure} /> : null}
    </CardForm>
  )
}

/** Who reads the template: its products and the attribute templates that carry it. */
function UsageCard({ template }: { template: AddonTemplate }) {
  const { t } = useTranslation()
  return (
    <SectionCard title={t(`${T}.usage`)} description={t(`${T}.usageHint`)}>
      <dl className="flex flex-col gap-3 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">{t(`${T}.linkedProducts`)}</dt>
          <dd className="font-medium tabular-nums">
            {t(`${T}.productCount`, { count: template.product_count })}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">{t(`${T}.carriedBy`)}</dt>
          <dd>
            {template.attribute_templates.length === 0 ? (
              <span className="text-muted-foreground">{t(`${T}.carriedByNone`)}</span>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {template.attribute_templates.map((each) => (
                  <li key={each.id} className="font-medium">
                    {each.name}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
    </SectionCard>
  )
}

/**
 * An add-on template on its own page (adr/0052 Ek 2026-11-23): its name
 * and add-ons in the main column, who uses it beside them; deleting from
 * the header's menu. Adding or editing an add-on opens the one add-on
 * dialog; nothing opens on top of it.
 */
export function AddonTemplatePage() {
  const { t } = useTranslation()
  const { id } = route.useParams()
  const navigate = useNavigate()
  const template = useQuery(addonTemplateQuery(id))
  const features = useQuery(featuresQuery())
  const state = useFeatureState(ADDONS_FLAG)
  const flagOn = features.isError ? false : state === true
  const remove = useDeleteAddonTemplate()
  const [deleting, setDeleting] = useState(false)
  const [applying, setApplying] = useState(false)

  if (template.isError) {
    return (
      <ErrorState text={errorText(t, template.error)} onRetry={() => void template.refetch()} />
    )
  }
  if (!template.data) {
    return <LoadingRows rows={6} />
  }
  const data = template.data
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        back={{ to: "/settings/attributes", label: t("attributes.title") }}
        title={data.name}
        description={t(`${T}.dialogHint`)}
        action={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setApplying(true)
              }}
            >
              <ListChecks />
              {t(`${T}.apply.action`)}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label={t("common.actions")}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    setDeleting(true)
                  }}
                >
                  <Trash2 />
                  {t(`${T}.delete`)}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />
      {flagOn ? null : <AddonNotice tone="warning" text={t("products.addons.flagOff")} features />}
      <PageGrid>
        <PageColumn span={8}>
          <NameCard key={`${data.id}-${data.name}`} template={data} flagOn={flagOn} />
          <AddonTemplateAddonsCard
            key={`${data.id}-${data.updated_at ?? ""}`}
            template={data}
            flagOn={flagOn}
          />
        </PageColumn>
        <PageColumn span={4} sticky>
          <UsageCard template={data} />
        </PageColumn>
      </PageGrid>
      <AddonTemplateApplyDialog
        key={data.id}
        template={data}
        open={applying}
        onOpenChange={setApplying}
        flagOn={flagOn}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t(`${T}.deleteTitle`, { name: data.name })}
        description={t(`${T}.deleteDescription`, { count: data.product_count })}
        confirmLabel={t(`${T}.delete`)}
        destructive
        onConfirm={() => {
          setDeleting(false)
          remove.mutate(data.id, {
            onSuccess: () => {
              toast.success(t(`${T}.deleted`))
              void navigate({ to: "/settings/attributes" })
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
    </div>
  )
}
