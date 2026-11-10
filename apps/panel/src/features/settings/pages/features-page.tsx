import { useQuery } from "@tanstack/react-query"
import { Lock, ToggleLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { featuresQuery, useSetFeature } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"

/**
 * Settings > Features (adr/0012): sector needs are switched on here, never
 * coded per sector. Flags that come with the plan show, but stay locked.
 */
export function FeaturesPage() {
  const { t } = useTranslation()
  const query = useQuery(featuresQuery())
  const toggle = useSetFeature()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("settings.features.title")}
        description={t("settings.features.subtitle")}
      />
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingRows rows={3} />
      ) : query.data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
          <ToggleLeft className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-md text-sm text-muted-foreground">{t("settings.features.empty")}</p>
        </div>
      ) : (
        <SectionCard title={t("settings.features.list")} flush>
          <ul className="flex flex-col">
            {query.data.map((feature) => {
              const locked = feature.owner !== "tenant"
              return (
                <li
                  key={feature.key}
                  className="flex items-start justify-between gap-4 border-t px-5 py-4"
                >
                  <label
                    htmlFor={`feature-${feature.key}`}
                    className="flex min-w-0 flex-col gap-0.5"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {t(`settings.features.flags.${feature.key}.label`, {
                        defaultValue: feature.key,
                      })}
                      {locked ? (
                        <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      ) : null}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {locked
                        ? t("settings.features.locked")
                        : t(`settings.features.flags.${feature.key}.description`, {
                            defaultValue: "",
                          })}
                    </span>
                  </label>
                  <Switch
                    id={`feature-${feature.key}`}
                    checked={feature.enabled}
                    disabled={locked || toggle.isPending}
                    onCheckedChange={(enabled) => {
                      toggle.mutate(
                        { key: feature.key, enabled },
                        {
                          onSuccess: () => toast.success(t("settings.saved")),
                          onError: (failure) => toast.error(errorText(t, failure)),
                        }
                      )
                    }}
                  />
                </li>
              )
            })}
          </ul>
        </SectionCard>
      )}
    </div>
  )
}
