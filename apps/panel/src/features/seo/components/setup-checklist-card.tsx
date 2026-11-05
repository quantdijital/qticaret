import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowRight, CircleDashed } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useCan } from "@/features/auth/api/staff"
import { seoSetupQuery } from "@/features/seo/api/setup"
import type { SeoSetupEntry, SeoSetupItem } from "@/features/seo/api/setup"

const C = "seo.setup"

// Where each item is done; the legal identity on the store profile's own tab
const WHERE: Record<
  SeoSetupItem,
  | "/settings/store"
  | "/settings/legal"
  | "/settings/seo"
  | "/settings/marketing"
  | "/settings/features"
> = {
  legal_identity: "/settings/store",
  legal_texts: "/settings/legal",
  canonical_host: "/settings/seo",
  robots: "/settings/seo",
  share_image: "/settings/seo",
  search_console: "/settings/marketing",
  merchant: "/settings/marketing",
  indexnow: "/settings/features",
}

function Item({ entry, mayAct }: { entry: SeoSetupEntry; mayAct: boolean }) {
  const { t } = useTranslation()
  const where = WHERE[entry.key]
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-5 py-3">
      <CircleDashed className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-0.5">
        <span className="text-sm font-medium">{t(`${C}.items.${entry.key}.title`)}</span>
        <span className="text-[13px] text-muted-foreground">
          {entry.blocked ? t(`${C}.blocked.${entry.blocked}`) : t(`${C}.items.${entry.key}.hint`)}
        </span>
      </div>
      {/* Google's items open where its account is connected, even while that is the step */}
      {mayAct ? (
        <Button asChild variant="outline" size="sm" className="ml-8 shrink-0 sm:ml-0">
          <Link
            to={where}
            {...(entry.key === "legal_identity" ? { search: { part: "legal" } } : {})}
          >
            {t(`${C}.go`)}
            <ArrowRight />
          </Link>
        </Button>
      ) : null}
    </li>
  )
}

/**
 * The SEO setup checklist (F12.10, docs/14 §5): what is still missing,
 * each with where it is done; a done item leaves the list and the card
 * goes once nothing is. Staff who may not change settings see it, not
 * the way in.
 */
export function SetupChecklistCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const query = useQuery(seoSetupQuery())
  const mayAct = useCan("settings")
  const items = query.data?.items ?? []
  const open = items.filter((entry) => !entry.done)
  if (open.length === 0) {
    return null
  }
  const done = items.length - open.length
  return (
    <SectionCard
      title={t(`${C}.title`)}
      description={t(`${C}.text`)}
      className={className}
      action={
        <div className="flex w-40 flex-col gap-1.5">
          <span className="text-xs text-muted-foreground tabular-nums sm:text-right">
            {t(`${C}.progress`, { done, total: items.length })}
          </span>
          <Progress value={(done / items.length) * 100} aria-label={t(`${C}.title`)} />
        </div>
      }
      flush
    >
      <ul className="flex flex-col">
        {open.map((entry) => (
          <Item key={entry.key} entry={entry} mayAct={mayAct} />
        ))}
      </ul>
    </SectionCard>
  )
}
