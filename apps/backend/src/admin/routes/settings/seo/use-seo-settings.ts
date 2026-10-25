import { toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import type { SeoSettings } from "../../../../modules/platform-settings/sections"
import { errorText } from "../../../lib/errors"
import { sdk } from "../../../lib/sdk"
import type { SeoForm } from "./form-schema"
import { toApi } from "./form-schema"

const QUERY_KEY = ["qticaret", "platform-settings", "seo"]

export interface SectionResponse {
  values: SeoSettings
  version: number
}

/** The SEO section from the API, and its save (toasts on both outcomes). */
export function useSeoSettings(onSaved: (saved: SectionResponse) => void) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => sdk.client.fetch<SectionResponse>("/admin/platform-settings/seo"),
  })
  const save = useMutation({
    mutationFn: (values: SeoForm) =>
      sdk.client.fetch<SectionResponse>("/admin/platform-settings/seo", {
        method: "POST",
        body: toApi(values),
      }),
    onSuccess: async (saved) => {
      toast.success(t("qticaret.settings.seo.saved"))
      onSaved(saved)
      await client.invalidateQueries({ queryKey: QUERY_KEY })
    },
    onError: (failure) => {
      toast.error(errorText(t, failure))
    },
  })
  return { query, save }
}
