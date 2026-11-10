import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ListChecks } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import {
  productAttributesQuery,
  templatesQuery,
  useSaveProductAttributes,
} from "@/features/attributes/api"
import { FactsDialog } from "@/features/attributes/facts/facts-dialog"
import type { AttributeValue, ProductAttributes } from "@/features/attributes/types"
import { useCan } from "@/features/auth/api/staff"
import type { SectionFindings } from "@/features/content/section-findings"
import { productFold } from "@/features/products/detail/sections"
import { errorText } from "@/lib/errors"
import { AttributeInput } from "./attribute-input"

const NONE = "__none__"

// A field left empty: nothing typed, picked or ticked
const isEmpty = (value: AttributeValue | undefined) =>
  value === null ||
  value === undefined ||
  value === "" ||
  (Array.isArray(value) && value.length === 0)

function AttributesForm({
  productId,
  saved,
  action,
  fold,
}: {
  productId: string
  saved: ProductAttributes
  /** Beside the title: bringing the description's facts over. */
  action?: ReactNode
  fold?: SectionFindings | undefined
}) {
  const { t } = useTranslation()
  const templates = useQuery(templatesQuery())
  const save = useSaveProductAttributes(productId)
  const [templateId, setTemplateId] = useState<string | null>(saved.template?.id ?? null)
  const [values, setValues] = useState<Record<string, AttributeValue>>(saved.values)
  const [confirmChange, setConfirmChange] = useState(false)
  const template =
    templateId === saved.template?.id
      ? saved.template
      : ((templates.data ?? []).find((item) => item.id === templateId) ?? null)
  // Variant attributes are the product's options (sizes, colours): edited with the variants
  const definitions = [...(template?.definitions ?? [])]
    .filter((definition) => definition.scope === "product")
    .sort((a, b) => a.rank - b.rank)
  const changedTemplate = templateId !== (saved.template?.id ?? null)
  const dirty = changedTemplate || JSON.stringify(values) !== JSON.stringify(saved.values)
  // Folded, its line: the template and how many of its fields are filled ("Bıçak şablonu · 14/18 alan dolu")
  const filled = definitions.filter((definition) => !isEmpty(values[definition.key])).length
  const requiredEmpty = definitions.filter(
    (definition) => definition.is_required && isEmpty(values[definition.key])
  ).length
  const collapse =
    fold &&
    productFold(
      t,
      "attributes",
      fold,
      [
        !template
          ? t("products.sections.noTemplate")
          : definitions.length > 0
            ? t("products.sections.template", {
                name: template.name,
                filled,
                total: definitions.length,
              })
            : t("products.sections.templateOnly", { name: template.name }),
        requiredEmpty > 0
          ? t("products.sections.requiredEmpty", { count: requiredEmpty })
          : undefined,
      ],
      // A required field left empty: it opens
      requiredEmpty > 0
    )

  const send = (confirm: boolean) => {
    const own = Object.fromEntries(
      definitions.map((definition) => [definition.key, values[definition.key] ?? null])
    )
    save.mutate(
      {
        template_id: templateId,
        ...(templateId ? { values: own } : {}),
        ...(confirm ? { confirm_template_change: true } : {}),
      },
      {
        onSuccess: (next) => {
          setValues(next.values)
          toast.success(t("attributes.productSaved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }

  return (
    <CardForm
      title={t("attributes.productCard")}
      description={t("attributes.productHint")}
      action={action}
      collapse={collapse}
      dirty={dirty}
      saving={save.isPending}
      onSubmit={() => {
        // A different template drops the old one's values: asked first
        if (changedTemplate && saved.template && Object.keys(saved.values).length > 0) {
          setConfirmChange(true)
        } else {
          send(false)
        }
      }}
      onReset={() => {
        setTemplateId(saved.template?.id ?? null)
        setValues(saved.values)
      }}
    >
      <Field
        label={t("attributes.template")}
        htmlFor="attributes-template"
        hint={templates.data?.length === 0 ? undefined : t("attributes.templatePickHint")}
      >
        {templates.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("attributes.noTemplates")}{" "}
            <Link to="/settings/attributes" className="underline">
              {t("attributes.openSettings")}
            </Link>
          </p>
        ) : (
          <Select
            value={templateId ?? NONE}
            onValueChange={(next) => {
              setTemplateId(next === NONE ? null : next)
            }}
          >
            <SelectTrigger id="attributes-template" className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("attributes.noTemplate")}</SelectItem>
              {(templates.data ?? []).map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      {definitions.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {definitions.map((definition) => (
            <AttributeInput
              key={definition.key}
              definition={definition}
              value={values[definition.key]}
              onChange={(next) => {
                setValues((was) => ({ ...was, [definition.key]: next }))
              }}
            />
          ))}
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmChange}
        onOpenChange={setConfirmChange}
        title={t("attributes.changeTemplateTitle")}
        description={t("attributes.changeTemplateDescription")}
        confirmLabel={t("attributes.changeTemplateConfirm")}
        destructive
        onConfirm={() => {
          send(true)
        }}
      />
    </CardForm>
  )
}

/**
 * The product's attributes by its template (adr/0013): material, length,
 * origin… whatever the shop defines. With `fold`, folded under the
 * product page's main parts to its template and filled count.
 */
export function AttributesCard({
  productId,
  fold,
}: {
  productId: string
  /** The advisor's findings for it: folded, counted in its line, an urgent one opens it. */
  fold?: SectionFindings
}) {
  const { t } = useTranslation()
  const query = useQuery(productAttributesQuery(productId))
  const canEdit = useCan("catalog")
  const [facts, setFacts] = useState(false)
  // The form starts again from the values a facts run wrote
  const [round, setRound] = useState(0)
  if (!query.data) {
    return <Skeleton className={fold ? "h-14 rounded-lg" : "h-40 rounded-lg"} />
  }
  return (
    <>
      <AttributesForm
        key={round}
        productId={productId}
        saved={query.data}
        fold={fold}
        action={
          canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFacts(true)
              }}
            >
              <ListChecks />
              {t("attributes.facts.action")}
            </Button>
          ) : undefined
        }
      />
      <FactsDialog
        productIds={facts ? [productId] : []}
        onClose={() => {
          setFacts(false)
        }}
        onDone={() => {
          void query.refetch().then(() => {
            setRound((was) => was + 1)
          })
        }}
      />
    </>
  )
}
