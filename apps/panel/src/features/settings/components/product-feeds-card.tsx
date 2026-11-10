import { useQuery } from "@tanstack/react-query"
import { CircleAlert, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { feedsQuery, useFeedAction } from "@/features/settings/api/marketing-feeds"
import { NotificationAddress } from "@/features/settings/components/notification-address"
import { errorText } from "@/lib/errors"
import { formatCount, formatRelative } from "@qticaret/admin-ui/lib/format"

const F = "settings.marketing.feeds"

/**
 * Settings > Marketing: the product feeds the shop gives Google Merchant
 * Center, Meta, Cimri and Akakçe (F10.8, adr/0038 §3), built from the same facts as its
 * pages every two hours. Their address carries a token: a new one stops
 * the old address at once.
 */
export function ProductFeedsCard() {
  const { t } = useTranslation()
  const status = useQuery(feedsQuery())
  const action = useFeedAction()
  const [asking, setAsking] = useState<"issue" | "off" | null>(null)
  const feeds = status.data?.feeds
  const run = (kind: "issue" | "off" | "generate") => {
    action.mutate(kind, {
      onSuccess: () => toast.success(t(`${F}.done.${kind}`)),
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  return (
    <SectionCard title={t(`${F}.title`)} description={t(`${F}.description`)}>
      {!feeds ? (
        <Skeleton className="h-24" />
      ) : !feeds.enabled ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground">{t(`${F}.off`)}</p>
          <Button
            disabled={action.isPending}
            onClick={() => {
              run("issue")
            }}
          >
            {action.isPending ? <Loader2 className="animate-spin" /> : null}
            {t(`${F}.turnOn`)}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {feeds.storefront_set ? null : (
            <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning-text">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t(`${F}.noDomain`)}
            </p>
          )}
          {feeds.targets.map((feed) =>
            feed.url ? (
              <div key={feed.target} className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t(`${F}.targets.${feed.target}`)}</span>
                <NotificationAddress
                  id={`feed-${feed.target}`}
                  url={feed.url}
                  label={t(`${F}.targets.${feed.target}`)}
                  hint={
                    feed.generated_at
                      ? t(`${F}.generated`, {
                          count: feed.item_count ?? 0,
                          items: formatCount(feed.item_count ?? 0),
                          when: formatRelative(feed.generated_at),
                        })
                      : t(feeds.storefront_set ? `${F}.building` : `${F}.notYet`)
                  }
                />
              </div>
            ) : null
          )}
          <div className="grid gap-2 sm:flex sm:justify-end">
            <Button
              variant="outline"
              disabled={action.isPending}
              onClick={() => {
                setAsking("off")
              }}
            >
              {t(`${F}.turnOff`)}
            </Button>
            <Button
              variant="outline"
              disabled={action.isPending}
              onClick={() => {
                setAsking("issue")
              }}
            >
              {t(`${F}.renew`)}
            </Button>
            <Button
              disabled={action.isPending}
              onClick={() => {
                run("generate")
              }}
            >
              {action.isPending ? <Loader2 className="animate-spin" /> : null}
              {t(`${F}.generate`)}
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={asking !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAsking(null)
          }
        }}
        title={t(`${F}.confirm.${asking ?? "issue"}.title`)}
        description={t(`${F}.confirm.${asking ?? "issue"}.description`)}
        confirmLabel={t(`${F}.confirm.${asking ?? "issue"}.action`)}
        destructive
        onConfirm={() => {
          if (asking) {
            run(asking)
          }
          setAsking(null)
        }}
      />
    </SectionCard>
  )
}
