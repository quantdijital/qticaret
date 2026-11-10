import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { CategoryTree } from "@/features/products/components/category-tree"
import { FEED_TARGET_NAMES, sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { FeedTargetName, MarketingSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"

const R = "settings.marketing.feedRules"
const F = "settings.marketing.feeds"

/**
 * Settings > Marketing: what each feed leaves out, by category (a
 * category takes the ones under it along). The same-day hour Akakçe shows
 * is set under Kargo > Teslim süresi since adr/0046 Ek 2026-11-06.
 */
export function FeedRulesCard() {
  const { t } = useTranslation()
  const section = useQuery(sectionQuery<MarketingSettings>("marketing"))
  const save = useSaveSection<MarketingSettings>("marketing")
  const [target, setTarget] = useState<FeedTargetName>("google")
  const [draft, setDraft] = useState<Partial<MarketingSettings>>({})
  const stored = section.data?.values
  const values = stored ? { ...stored, ...draft } : null
  return (
    <SectionCard title={t(`${R}.title`)} description={t(`${R}.description`)}>
      {!values ? (
        <Skeleton className="h-48" />
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate(draft, {
              onSuccess: () => {
                setDraft({})
                toast.success(t(`${R}.saved`))
              },
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }}
        >
          <div className="flex flex-col gap-2">
            <span id="feed-exclusions-label" className="text-sm font-medium">
              {t(`${R}.exclusions`)}
            </span>
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={1}
              aria-labelledby="feed-exclusions-label"
              className="grid w-full grid-cols-2 gap-1 sm:flex"
              value={target}
              onValueChange={(next) => {
                if (next) {
                  setTarget(next as FeedTargetName)
                }
              }}
            >
              {FEED_TARGET_NAMES.map((name) => (
                <ToggleGroupItem
                  key={name}
                  value={name}
                  className="flex-1 px-3 text-[13px] data-[state=on]:bg-accent data-[state=on]:font-medium data-[state=on]:text-accent-foreground"
                >
                  {t(`${F}.short.${name}`)}
                  {values.feed_exclusions[name].length > 0
                    ? ` (${String(values.feed_exclusions[name].length)})`
                    : ""}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <span className="text-[13px] text-muted-foreground">
              {t(`${R}.exclusionsHint`, { target: t(`${F}.short.${target}`) })}
            </span>
            <CategoryTree
              value={values.feed_exclusions[target]}
              onChange={(ids) => {
                setDraft((current) => ({
                  ...current,
                  feed_exclusions: { ...values.feed_exclusions, [target]: ids },
                }))
              }}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={Object.keys(draft).length === 0 || save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </div>
        </form>
      )}
    </SectionCard>
  )
}
