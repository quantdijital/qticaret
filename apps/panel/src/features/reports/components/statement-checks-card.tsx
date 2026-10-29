import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Loader2, RefreshCw } from "lucide-react"
import { Fragment } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { statementChecksQuery, useRecheckStatement } from "@/features/reports/api/statements"
import type {
  StatementCheck,
  StatementChecks,
  StatementIssue,
} from "@/features/reports/api/statements"
import { useReportRange } from "@/features/reports/use-report"
import { errorText } from "@/lib/errors"
import { formatCount, formatMoney } from "@/lib/format"

const S = "reports.finance.statements"

/** "28.10.2026": a Turkish day as written, whatever the browser's time zone. */
const dayText = (day: string) => day.split("-").reverse().join(".")

/** The issue's order as a link, or a dash for money with no order. */
function OrderRef({ issue }: { issue: StatementIssue }) {
  return issue.order_id ? (
    <Link to="/orders/$id" params={{ id: issue.order_id }} className="font-medium hover:underline">
      #{issue.display_id ?? "—"}
    </Link>
  ) : (
    <span className="text-muted-foreground">—</span>
  )
}

/** Each provider: whether it is checked, and how its days in the period went. */
function ProviderStates({ data }: { data: StatementChecks }) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-3 px-5 pb-4 sm:grid-cols-2">
      {data.providers.map(({ provider, connected, test_mode }) => {
        const checks = data.checks.filter((check) => check.provider === provider)
        const count = (status: StatementCheck["status"]) =>
          checks.filter((check) => check.status === status).length
        const live = connected && !test_mode
        const [tone, state]: [StatusTone, string] = live
          ? ["success", "live"]
          : connected
            ? ["neutral", "testMode"]
            : ["neutral", "notConnected"]
        return (
          <div
            key={provider}
            className="flex h-full flex-col gap-1.5 rounded-md border px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {t(`settings.payments.methods.${provider}.name`, { defaultValue: provider })}
              </span>
              <StatusBadge tone={tone}>{t(`${S}.states.${state}`)}</StatusBadge>
            </div>
            <span className="text-xs text-muted-foreground">
              {checks.length === 0
                ? t(live ? `${S}.waiting` : `${S}.notChecked`)
                : t(`${S}.days`, {
                    matched: formatCount(count("matched")),
                    mismatched: formatCount(count("mismatched")),
                    failed: formatCount(count("failed")),
                  })}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * The providers' statements against the shop (F11.3): each morning
 * yesterday's PayTR and iyzico statements are compared with the orders'
 * payments; the days that do not agree are listed with what differs.
 */
export function StatementChecksCard({ currencyCode }: { currencyCode: string }) {
  const { t } = useTranslation()
  const { data } = useQuery(statementChecksQuery(useReportRange()))
  const recheck = useRecheckStatement()
  if (!data) {
    return <Skeleton className="h-48 rounded-lg" />
  }
  const money = (amount: string) => formatMoney(amount, currencyCode)
  const problems = data.checks.filter((check) => check.status !== "matched")
  const again = (check: StatementCheck) => {
    recheck.mutate(
      { provider: check.provider, day: check.day },
      {
        onSuccess: (result) => {
          toast.success(t(result.status === "matched" ? `${S}.nowMatched` : `${S}.checkedAgain`))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  return (
    <SectionCard title={t(`${S}.title`)} description={t(`${S}.hint`)} flush>
      <ProviderStates data={data} />
      {problems.length === 0 ? (
        <p className="border-t px-5 py-4 text-sm text-muted-foreground">
          {t(data.checks.length === 0 ? `${S}.none` : `${S}.allMatched`)}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">{t(`${S}.kind`)}</TableHead>
              <TableHead className="hidden sm:table-cell">{t(`${S}.order`)}</TableHead>
              <TableHead className="hidden md:table-cell">{t(`${S}.reference`)}</TableHead>
              <TableHead className="text-right">{t(`${S}.shop`)}</TableHead>
              <TableHead className="pr-5 text-right">{t(`${S}.provider`)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {problems.map((check) => (
              <Fragment key={`${check.provider}-${check.day}`}>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableCell colSpan={5} className="px-5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="font-medium tabular-nums">
                        {dayText(check.day)} ·{" "}
                        {t(`settings.payments.methods.${check.provider}.name`, {
                          defaultValue: check.provider,
                        })}
                      </span>
                      <StatusBadge tone={check.status === "failed" ? "warning" : "danger"}>
                        {t(`${S}.status.${check.status}`)}
                      </StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        {check.status === "failed"
                          ? t(`${S}.errors.${check.error_code ?? "other"}`, {
                              defaultValue: t(`${S}.errors.other`, { code: check.error_code }),
                            })
                          : t(`${S}.differences`, { count: check.issues.length })}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-auto"
                        disabled={recheck.isPending}
                        onClick={() => {
                          again(check)
                        }}
                      >
                        {recheck.isPending &&
                        recheck.variables.day === check.day &&
                        recheck.variables.provider === check.provider ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <RefreshCw />
                        )}
                        {t(`${S}.recheck`)}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {check.issues.map((issue) => (
                  <TableRow key={`${check.provider}-${check.day}-${issue.kind}-${issue.reference}`}>
                    <TableCell className="pl-5 whitespace-normal">
                      {t(`${S}.kinds.${issue.kind}`)}
                      {/* On a phone the order sits under the difference, both amounts stay */}
                      <span className="block text-xs tabular-nums sm:hidden">
                        <OrderRef issue={issue} />
                      </span>
                    </TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">
                      <OrderRef issue={issue} />
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs md:table-cell">
                      {issue.reference}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{money(issue.shop)}</TableCell>
                    <TableCell className="pr-5 text-right tabular-nums">
                      {money(issue.provider)}
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}
