import { Button, Container, Heading, Text } from "@medusajs/ui"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

// The jobs a shop owner comes back for; texts under qticaret.home.actions.<key>
const ACTIONS = [
  { key: "addProduct", to: "/products/create" },
  { key: "orders", to: "/orders" },
  { key: "settings", to: "/settings" },
] as const

/** Shortcuts to the screens used most; static links, so no loading or error state. */
export function QuickActions() {
  const { t } = useTranslation()
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">{t("qticaret.home.actions.title")}</Heading>
      </div>
      <ul className="grid grid-cols-1 gap-4 px-6 py-4 md:grid-cols-3">
        {ACTIONS.map((action) => (
          <li
            key={action.key}
            className="bg-ui-bg-subtle flex flex-col items-start justify-between gap-3 rounded-lg border p-4"
          >
            <div className="flex flex-col gap-1">
              <Text size="small" weight="plus">
                {t(`qticaret.home.actions.${action.key}.title`)}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                {t(`qticaret.home.actions.${action.key}.description`)}
              </Text>
            </div>
            <Button size="small" variant="secondary" asChild>
              <Link to={action.to}>{t(`qticaret.home.actions.${action.key}.button`)}</Link>
            </Button>
          </li>
        ))}
      </ul>
    </Container>
  )
}
