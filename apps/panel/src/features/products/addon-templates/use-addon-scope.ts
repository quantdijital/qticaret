import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  useLinkAddonTemplates,
  useSaveAddonTemplate,
} from "@/features/products/api/addon-templates"
import type { ProductAddonTemplate } from "@/features/products/api/addon-templates"
import { startScopedBulkEdit } from "@/features/products/api/bulk"
import { toastBulkJob } from "@/features/products/bulk/bulk-job-toast"
import type { AddonsFailure } from "@/features/products/detail/addon-failure"
import { inputOf } from "@/features/products/detail/addon-values"
import type { AddonValue } from "@/features/products/detail/addon-values"
import { errorText } from "@/lib/errors"
import { DEFAULT_SCOPE } from "./addon-scope"
import type { AddonScope, ScopeCategory } from "./addon-scope"
import { templateFailureOf } from "./template-failure"

interface Callbacks {
  /** Saved (and the link made or its job started): the dialog closes. */
  done: () => void
  /** Refused before anything was kept: said in the dialog, which stays open. */
  fail: (failure: AddonsFailure) => void
}

/**
 * The product dialog's "Kapsam" (2026-11-23): its choice, and saving a new
 * add-on as a template applied to products. The template is made first;
 * linking it to this product is the product's own link, to more of them
 * the bulk edit job (the whole catalogue or the category's, on the
 * server), whose outcome a toast tells once it has finished. A template
 * made whose link then fails is kept: the toast says so, and its page
 * applies it again.
 */
export function useAddonScope(
  productId: string,
  templates: readonly ProductAddonTemplate[],
  category: ScopeCategory | null,
  flagOn: boolean
) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const saveTemplate = useSaveAddonTemplate()
  const link = useLinkAddonTemplates(productId)
  const [scope, setScope] = useState<AddonScope>(DEFAULT_SCOPE)
  const [saving, setSaving] = useState(false)

  const settled = () => {
    void client.invalidateQueries({ queryKey: ["products"] })
    void client.invalidateQueries({ queryKey: ["addon-templates"] })
  }

  const apply = async (value: AddonValue, { done, fail }: Callbacks) => {
    setSaving(true)
    let templateId: string | null = null
    try {
      const saved = await saveTemplate.mutateAsync({
        id: null,
        name: scope.name.trim() || value.label.trim(),
        addons: [inputOf(value)],
      })
      templateId = saved.id
      if (scope.target === "product") {
        const direct = templates.filter((each) => each.via === "product").map((each) => each.id)
        await link.mutateAsync([...direct, saved.id])
        toast.success(t("products.addonScope.linked"))
      } else {
        const job = await startScopedBulkEdit(
          scope.target === "category" && category
            ? { kind: "category", category_id: category.id }
            : { kind: "all" },
          { action: "addon_template", mode: "add", template_id: saved.id }
        )
        void toastBulkJob(t, job.id, settled)
      }
      done()
    } catch (failure) {
      if (templateId === null) {
        fail(templateFailureOf(t, failure, flagOn))
      } else {
        // The template is kept: retrying here would make a second one
        toast.error(`${t("products.addonScope.notApplied")} ${errorText(t, failure)}`)
        settled()
        done()
      }
    } finally {
      setSaving(false)
    }
  }

  return {
    scope,
    setScope,
    reset: () => {
      setScope(DEFAULT_SCOPE)
    },
    saving,
    apply,
  }
}
