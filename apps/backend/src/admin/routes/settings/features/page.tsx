import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Container, Heading, Switch, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import type { FeatureState } from "../../../../modules/platform-settings/types"
import { ErrorState, LoadingRows } from "../../../components/page-states"
import { errorText } from "../../../lib/errors"
import { sdk } from "../../../lib/sdk"

const QUERY_KEY = ["qticaret", "features"]

/**
 * Settings > Features (F2.3, adr/0012): the shop's feature flags. Platform
 * flags (plans, provisioning) are shown read-only; the API refuses them too.
 */
function FeaturesPage() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => sdk.client.fetch<{ features: FeatureState[] }>("/admin/features"),
  })
  const toggle = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      sdk.client.fetch(`/admin/features/${encodeURIComponent(key)}`, {
        method: "POST",
        body: { enabled },
      }),
    onSuccess: async () => {
      toast.success(t("qticaret.settings.features.saved"))
      await client.invalidateQueries({ queryKey: QUERY_KEY })
    },
    onError: (failure) => {
      toast.error(errorText(t, failure))
    },
  })

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h1">{t("qticaret.settings.features.title")}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {t("qticaret.settings.features.subtitle")}
        </Text>
      </div>
      <div className="px-6 py-4">
        {isPending ? (
          <LoadingRows />
        ) : isError ? (
          <ErrorState text={errorText(t, error)} onRetry={() => void refetch()} />
        ) : data.features.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            {t("qticaret.settings.features.empty")}
          </Text>
        ) : (
          <ul className="flex flex-col divide-y">
            {data.features.map((feature) => (
              <li key={feature.key} className="flex items-start justify-between gap-4 py-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`feature-${feature.key}`} className="txt-compact-small-plus">
                    {t(feature.labelKey, { defaultValue: feature.key })}
                  </label>
                  <Text size="small" className="text-ui-fg-subtle">
                    {t(feature.descriptionKey, { defaultValue: "" })}
                  </Text>
                  {feature.owner === "platform" && (
                    <Badge size="2xsmall" className="w-fit">
                      {t("qticaret.settings.features.platformManaged")}
                    </Badge>
                  )}
                </div>
                <Switch
                  id={`feature-${feature.key}`}
                  checked={feature.enabled}
                  disabled={feature.owner === "platform" || toggle.isPending}
                  onCheckedChange={(enabled) => {
                    toggle.mutate({ key: feature.key, enabled })
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Container>
  )
}

// The label is a key in the namespace our strings merge into (src/admin/i18n)
export const config = defineRouteConfig({
  label: "qticaret.settings.features.title",
  translationNs: "translation",
})

export default FeaturesPage
