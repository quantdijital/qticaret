import { Link } from "@tanstack/react-router"
import { ArrowRight, CornerDownRight, CornerUpRight, Loader2 } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { AuditItem, AuditRuleId } from "@/features/seo/api/audit"
import { useSaveRedirect } from "@/features/seo/api/redirects"
import { errorText } from "@/lib/errors"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"

// Rules whose items are about something with a name or a path: that leads the row
const NAMED: ReadonlySet<AuditRuleId> = new Set([
  "S-404-01",
  "S-DUP-01",
  "S-ORPHAN-01",
  "S-REDIR-01",
  "S-ROBOTS-01",
  "S-IMG-01",
  "S-GSC-01",
])

/** A way to the place the item is fixed; the link inside keeps its route's types. */
function GoTo({ children }: { children: ReactNode }) {
  return (
    <Button asChild size="sm" variant="ghost" className="h-7 shrink-0 text-xs">
      {children}
    </Button>
  )
}

/** A 404 with a likely page: one click makes the 301 (docs/14 S-404-01 KK). */
function RedirectButton({ source, target }: { source: string; target: string }) {
  const { t } = useTranslation()
  const save = useSaveRedirect()
  const [done, setDone] = useState(false)
  if (done) {
    return <StatusBadge tone="success">{t("seo.audit.actions.redirected")}</StatusBadge>
  }
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 shrink-0 text-xs"
      disabled={save.isPending}
      onClick={() => {
        save.mutate(
          {
            rule: {
              match: "exact",
              source,
              target,
              status: 301,
              query_policy: "keep",
              query_keep: [],
            },
          },
          {
            onSuccess: () => {
              setDone(true)
              toast.success(t("seo.redirects.form.created"))
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          }
        )
      }}
    >
      {save.isPending ? <Loader2 className="animate-spin" /> : <CornerUpRight />}
      {t("seo.audit.actions.redirect")}
    </Button>
  )
}

function ActionLabel({ action }: { action: string }) {
  const { t } = useTranslation()
  return (
    <>
      {t(`seo.audit.actions.${action}`)}
      <ArrowRight />
    </>
  )
}

/** The page of the record an item names. */
function EntityLink({ entity }: { entity: NonNullable<AuditItem["entity"]> }) {
  switch (entity.kind) {
    case "product":
      return (
        <GoTo>
          <Link to="/products/$id" params={{ id: entity.id }}>
            <ActionLabel action="openPage" />
          </Link>
        </GoTo>
      )
    case "category":
      return (
        <GoTo>
          <Link to="/categories/$id" params={{ id: entity.id }}>
            <ActionLabel action="openPage" />
          </Link>
        </GoTo>
      )
    case "brand":
      return (
        <GoTo>
          <Link to="/brands/$id" params={{ id: entity.id }}>
            <ActionLabel action="openPage" />
          </Link>
        </GoTo>
      )
    case "landing":
      return (
        <GoTo>
          <Link to="/content/landings/$id" params={{ id: entity.id }}>
            <ActionLabel action="openPage" />
          </Link>
        </GoTo>
      )
    // A content page is the theme editor's, its settings open (adr/0073 Ek 2026-11-19 (2) K5)
    case "page":
      return (
        <GoTo>
          <Link to="/storefront/editor" search={{ icerik: entity.id, ayar: "sayfa" }}>
            <ActionLabel action="openPage" />
          </Link>
        </GoTo>
      )
    case "post":
      return (
        <GoTo>
          <Link to="/content/$id" params={{ id: entity.id }}>
            <ActionLabel action="openPage" />
          </Link>
        </GoTo>
      )
    case "collection":
      return (
        <GoTo>
          <Link to="/collections/$id" params={{ id: entity.id }}>
            <ActionLabel action="openPage" />
          </Link>
        </GoTo>
      )
  }
}

function ItemAction({ ruleId, item }: { ruleId: AuditRuleId; item: AuditItem }) {
  if (ruleId === "S-404-01") {
    return item.target ? (
      <RedirectButton source={item.subject} target={item.target} />
    ) : (
      <GoTo>
        <Link to="/settings/seo" search={{ part: "redirects", tab: "missing", q: item.subject }}>
          <ActionLabel action="chooseTarget" />
        </Link>
      </GoTo>
    )
  }
  if (ruleId === "S-HOST-01" || ruleId === "S-ROBOTS-01") {
    return (
      <GoTo>
        <Link to="/settings/seo" search={{ part: ruleId === "S-HOST-01" ? "addresses" : "search" }}>
          <ActionLabel action="openSettings" />
        </Link>
      </GoTo>
    )
  }
  if (item.entity) {
    return <EntityLink entity={item.entity} />
  }
  return ruleId === "S-REDIR-01" ? (
    <GoTo>
      <Link to="/settings/seo" search={{ part: "redirects", q: item.subject }}>
        <ActionLabel action="openRule" />
      </Link>
    </GoTo>
  ) : null
}

/** One thing a finding names: what it is, why it is listed, and the way to fix it. */
export function AuditItemRow({ ruleId, item }: { ruleId: AuditRuleId; item: AuditItem }) {
  const { t } = useTranslation()
  const values = {
    // A Core Web Vital's item names a form factor (PHONE), worded here
    subject: ruleId === "S-CWV-01" ? t(`seo.vitals.formFactors.${item.subject}`) : item.subject,
    count: item.count ?? 0,
    amount: formatCount(item.count ?? 0),
    target: item.target ?? "",
  }
  const reason = t(`seo.audit.reasons.${ruleId}.${item.reason}`, values)
  const named = NAMED.has(ruleId)
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
      <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-0.5">
        {named ? (
          <span
            className={cn(
              "truncate text-[13px]",
              item.subject.startsWith("/") || ruleId === "S-ROBOTS-01" ? "font-mono" : "font-medium"
            )}
            title={item.subject}
          >
            {item.subject}
          </span>
        ) : null}
        <span className={cn("text-[13px]", named ? "text-xs text-muted-foreground" : "leading-5")}>
          {reason}
        </span>
        {ruleId === "S-404-01" && item.target ? (
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <CornerDownRight className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {t("seo.audit.suggested")}{" "}
              <span className="font-mono text-foreground">{item.target}</span>
            </span>
          </span>
        ) : null}
      </div>
      <ItemAction ruleId={ruleId} item={item} />
    </li>
  )
}
