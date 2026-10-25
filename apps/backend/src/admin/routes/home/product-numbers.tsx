import { Button, Container, Heading, Text } from "@medusajs/ui"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { ErrorState, LoadingRows } from "../../components/page-states"
import type { ProductCounts } from "./use-home-data"
import { useProductCounts } from "./use-home-data"

/**
 * Product numbers: cheap counts with no personal data. Order and revenue
 * numbers need a backend summary endpoint first (docs/17).
 */
export function ProductNumbers() {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch } = useProductCounts()

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <Heading level="h2">{t("qticaret.home.numbers.title")}</Heading>
        <Button size="small" variant="transparent" asChild>
          <Link to="/products">{t("qticaret.home.numbers.viewAll")}</Link>
        </Button>
      </div>
      <div className="px-6 py-4">
        {isPending ? (
          <LoadingRows rows={2} />
        ) : isError ? (
          <ErrorState text={t("qticaret.home.numbers.error")} onRetry={() => void refetch()} />
        ) : data.published + data.draft === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <Text size="small" className="text-ui-fg-subtle">
              {t("qticaret.home.numbers.empty")}
            </Text>
            <Button size="small" variant="secondary" asChild>
              <Link to="/products/create">{t("qticaret.home.actions.addProduct.button")}</Link>
            </Button>
          </div>
        ) : (
          <NumberTiles counts={data} />
        )}
      </div>
    </Container>
  )
}

function NumberTiles({ counts }: { counts: ProductCounts }) {
  const { t, i18n } = useTranslation()
  const tiles = [
    { key: "published", value: counts.published },
    { key: "draft", value: counts.draft },
  ] as const
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {tiles.map((tile) => (
        <div key={tile.key} className="flex flex-col gap-1 rounded-lg border p-4">
          <dt>
            <Text size="small" weight="plus">
              {t(`qticaret.home.numbers.${tile.key}.label`)}
            </Text>
          </dt>
          <dd className="flex flex-col gap-1">
            <Heading level="h2">{tile.value.toLocaleString(i18n.language)}</Heading>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {t(`qticaret.home.numbers.${tile.key}.hint`)}
            </Text>
          </dd>
        </div>
      ))}
    </dl>
  )
}
