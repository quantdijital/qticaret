import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  googleQuery,
  searchConsoleSitesQuery,
  startGoogleConnect,
  useSaveSearchConsoleSite,
} from "@/features/settings/api/google"
import { errorText } from "@/lib/errors"

const C = "settings.seo.searchConsole"

/**
 * Settings > SEO: the shop's Search Console property (F10.11), read with
 * the Google account connected under Settings > Marketing. Every night the
 * sitemap is submitted, the pages' figures read, pages inspected; the SEO
 * page and the audit show them.
 */
export function SearchConsoleCard() {
  const { t } = useTranslation()
  const status = useQuery(googleQuery())
  const google = status.data?.google
  const granted = google?.connected === true && google.search_console.granted
  const sites = useQuery(searchConsoleSitesQuery(granted))
  const save = useSaveSearchConsoleSite()
  const [chosen, setChosen] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const site = chosen ?? google?.search_console.site ?? ""
  return (
    <SectionCard title={t(`${C}.title`)} description={t(`${C}.description`)}>
      {!google ? (
        <Skeleton className="h-16" />
      ) : !google.configured || !google.connected ? (
        <p className="text-[13px] text-muted-foreground">
          {t(`${C}.notConnected`)}{" "}
          <Link to="/settings/marketing" className="underline underline-offset-2">
            {t(`${C}.goConnect`)}
          </Link>
        </p>
      ) : !google.search_console.granted ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground">{t(`${C}.notGranted`)}</p>
          <Button
            variant="outline"
            disabled={leaving}
            onClick={() => {
              setLeaving(true)
              startGoogleConnect().then(
                ({ url }) => {
                  window.location.assign(url)
                },
                (failure: unknown) => {
                  setLeaving(false)
                  toast.error(errorText(t, failure))
                }
              )
            }}
          >
            {leaving ? <Loader2 className="animate-spin" /> : null}
            {t(`${C}.reconnect`)}
          </Button>
        </div>
      ) : !sites.data ? (
        <Skeleton className="h-16" />
      ) : sites.data.sites.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{t(`${C}.noSites`)}</p>
      ) : (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate(site, {
              onSuccess: () => {
                setChosen(null)
                toast.success(t(`${C}.saved`))
              },
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }}
        >
          <div className="flex min-w-0 flex-[1_1_18rem] flex-col gap-2">
            <span id="search-console-site-label" className="text-sm font-medium">
              {t(`${C}.site`)}
            </span>
            <Select value={site} onValueChange={setChosen}>
              <SelectTrigger aria-labelledby="search-console-site-label">
                <SelectValue placeholder={t(`${C}.choose`)} />
              </SelectTrigger>
              <SelectContent>
                {sites.data.sites.map((each) => (
                  <SelectItem key={each.site_url} value={each.site_url}>
                    {each.site_url}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={chosen === null || save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("common.save")}
          </Button>
        </form>
      )}
    </SectionCard>
  )
}
