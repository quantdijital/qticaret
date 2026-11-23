import { useQuery } from "@tanstack/react-query"
import { ToggleLeft } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { SearchInput } from "@qticaret/admin-ui/patterns/search-input"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import type { FeatureState } from "@/features/settings/api/features"
import { featuresQuery, useSetFeature } from "@/features/settings/api/features"
import { COLLECTIONS_FLAG } from "@/features/collections/paths"
import { CollectionsOffConfirm } from "@/features/settings/components/collections-off-confirm"
import { FeatureRow } from "@/features/settings/components/feature-row"
import type { FeatureGroup } from "@/features/settings/feature-groups"
import {
  FEATURE_GROUPS,
  FEATURE_REQUIRES,
  LEFT_GROUPS,
  groupFeatures,
  groupOf,
  matchesSearch,
} from "@/features/settings/feature-groups"
import { useFeatureText } from "@/features/settings/feature-text"
import { errorText } from "@/lib/errors"

/**
 * Settings > Features (adr/0012): sector needs are switched on here, never
 * coded per sector. The flags sit in cards by area, two columns on a wide
 * screen; a search narrows every card at once. Flags that come with the
 * plan show, but stay locked.
 */
export function FeaturesPage() {
  const { t } = useTranslation()
  const query = useQuery(featuresQuery())
  const toggle = useSetFeature()
  const textOf = useFeatureText()
  const [search, setSearch] = useState("")
  const [confirmOff, setConfirmOff] = useState(false)

  const save = (key: string, enabled: boolean) => {
    toggle.mutate(
      { key, enabled },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }

  const features = query.data ?? []
  const shown = search
    ? features.filter((feature) => {
        const text = textOf(feature.key)
        const group = t(`settings.features.groups.${groupOf(feature.key)}.title`)
        return matchesSearch([text.label, text.summary, text.description, group], search)
      })
    : features
  const groups = groupFeatures(shown)
  const left = groups.filter((group) => groupIndex(group) < LEFT_GROUPS)
  const right = groups.filter((group) => groupIndex(group) >= LEFT_GROUPS)

  const requiresOf = (feature: FeatureState) => {
    const needed = FEATURE_REQUIRES[feature.key]
    const other = needed ? features.find((entry) => entry.key === needed) : undefined
    return other && !other.enabled ? { label: textOf(other.key).label } : undefined
  }

  const card = (group: FeatureGroup) => (
    <SectionCard
      key={group.id}
      title={t(`settings.features.groups.${group.id}.title`)}
      description={t(`settings.features.groups.${group.id}.description`)}
      flush
    >
      <ul className="flex flex-col">
        {group.features.map((feature) => (
          <FeatureRow
            key={feature.key}
            feature={feature}
            requires={requiresOf(feature)}
            busy={toggle.isPending}
            onToggle={(enabled) => {
              // Collections off takes their pages offline: asked first (a warning, not a block)
              if (feature.key === COLLECTIONS_FLAG && !enabled) {
                setConfirmOff(true)
                return
              }
              save(feature.key, enabled)
            }}
          />
        ))}
      </ul>
    </SectionCard>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("settings.features.title")}
        description={t("settings.features.subtitle")}
        action={
          features.length > 0 ? (
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t("settings.features.search")}
            />
          ) : null
        }
      />
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingRows rows={3} />
      ) : features.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
          <ToggleLeft className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-md text-sm text-muted-foreground">{t("settings.features.empty")}</p>
        </div>
      ) : groups.length === 0 ? (
        <p className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          {t("settings.features.noMatch")}
        </p>
      ) : left.length > 0 && right.length > 0 ? (
        <PageGrid>
          <PageColumn span={6}>{left.map(card)}</PageColumn>
          <PageColumn span={6}>{right.map(card)}</PageColumn>
        </PageGrid>
      ) : (
        // A search that leaves one column: its cards take the whole width
        <div className="flex flex-col gap-[var(--grid-gap)]">{groups.map(card)}</div>
      )}
      {confirmOff ? (
        <CollectionsOffConfirm
          onConfirm={() => {
            setConfirmOff(false)
            save(COLLECTIONS_FLAG, false)
          }}
          onCancel={() => {
            setConfirmOff(false)
          }}
        />
      ) : null}
    </div>
  )
}

/** A group's place in the page's order; "other" (a flag not mapped yet) goes last, right. */
function groupIndex(group: FeatureGroup): number {
  const index = FEATURE_GROUPS.findIndex((entry) => entry.id === group.id)
  return index === -1 ? FEATURE_GROUPS.length : index
}
