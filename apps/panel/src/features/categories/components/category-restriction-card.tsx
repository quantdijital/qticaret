import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import {
  categoryRestrictionsQuery,
  useSetCategoryRestriction,
} from "@/features/categories/api/restrictions"
import type { Restriction } from "@/features/categories/api/restrictions"
import { useFeature } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"
import { RestrictionSelect } from "./restriction-select"

function Form({ categoryId, saved }: { categoryId: string; saved: Restriction | null }) {
  const { t } = useTranslation()
  const save = useSetCategoryRestriction(categoryId)
  const [value, setValue] = useState(saved)
  return (
    <CardForm
      title={t("restrictions.label")}
      description={t("restrictions.categoryHint")}
      dirty={value !== saved}
      saving={save.isPending}
      onSubmit={() => {
        save.mutate(value, {
          onSuccess: () => toast.success(t("categories.saved")),
          onError: (failure) => toast.error(errorText(t, failure)),
        })
      }}
      onReset={() => {
        setValue(saved)
      }}
    >
      <Field label={t("restrictions.reason")} htmlFor="category-restriction">
        <RestrictionSelect id="category-restriction" value={value} onChange={setValue} />
      </Field>
    </CardForm>
  )
}

/**
 * A category's age limit (F13.4, adr/0041 §4): its children and every
 * product in them are sold to adults only. Shown once the shop sells such
 * products, or when the category is already marked.
 */
export function CategoryRestrictionCard({ categoryId }: { categoryId: string }) {
  const on = useFeature("catalog.restricted")
  const query = useQuery(categoryRestrictionsQuery())
  const saved = query.data?.get(categoryId) ?? null
  if (!query.data || (!on && saved === null)) {
    return null
  }
  return <Form key={`${categoryId}-${saved ?? ""}`} categoryId={categoryId} saved={saved} />
}
