import { Button, Container, Heading, Text } from "@medusajs/ui"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { ErrorState, LoadingRows } from "../../components/page-states"
import type { HomeSummary } from "./use-home-data"
import { useHomeSummary } from "./use-home-data"

/**
 * Today and the orders waiting for the shop (docs/17): numbers the server
 * works out from statuses and amounts, no customer data.
 */
export function OrderNumbers() {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch } = useHomeSummary()

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <Heading level="h2">{t("qticaret.home.orders.title")}</Heading>
        <Button size="small" variant="transparent" asChild>
          <Link to="/orders">{t("qticaret.home.orders.viewAll")}</Link>
        </Button>
      </div>
      <div className="px-6 py-4">
        {isPending ? (
          <LoadingRows rows={2} />
        ) : isError ? (
          <ErrorState text={t("qticaret.home.orders.error")} onRetry={() => void refetch()} />
        ) : (
          <OrderTiles summary={data} />
        )}
      </div>
    </Container>
  )
}

function OrderTiles({ summary }: { summary: HomeSummary }) {
  const { t, i18n } = useTranslation()
  const count = (value: number) => value.toLocaleString(i18n.language)
  const money = (amount: string, currency: string) =>
    new Intl.NumberFormat(i18n.language, { style: "currency", currency }).format(Number(amount))
  const sales = summary.today.sales.length
    ? summary.today.sales.map((sale) => money(sale.amount, sale.currency_code)).join(" · ")
    : money("0", "TRY")
  const tiles = [
    {
      key: "awaiting",
      value: `${count(summary.awaiting_shipment)}${summary.capped ? "+" : ""}`,
    },
    { key: "todayOrders", value: count(summary.today.orders) },
    { key: "todaySales", value: `${sales}${summary.today.capped ? "+" : ""}` },
  ] as const
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {tiles.map((tile) => (
        <div key={tile.key} className="flex flex-col gap-1 rounded-lg border p-4">
          <dt>
            <Text size="small" weight="plus">
              {t(`qticaret.home.orders.${tile.key}.label`)}
            </Text>
          </dt>
          <dd className="flex flex-col gap-1">
            <Heading level="h2">{tile.value}</Heading>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {t(`qticaret.home.orders.${tile.key}.hint`)}
            </Text>
          </dd>
        </div>
      ))}
    </dl>
  )
}
