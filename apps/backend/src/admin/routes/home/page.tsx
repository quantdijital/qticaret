import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text } from "@medusajs/ui"
import { useTranslation } from "react-i18next"
import { HomeIcon } from "./home-icon"
import { OrderNumbers } from "./order-numbers"
import { ProductNumbers } from "./product-numbers"
import { QuickActions } from "./quick-actions"
import { SetupChecklist } from "./setup-checklist"
import { useFirstName } from "./use-home-data"

/**
 * Home (docs/17): where a shop owner starts. What is left to set up, the
 * screens used most and a few numbers, in plain words. Medusa sends "/" and
 * the login to Orders and offers no setting for it, so this page is reached
 * from the sidebar.
 */
function HomePage() {
  const { t } = useTranslation()
  // The greeting falls back to a plain "Hello" while loading or on error
  const firstName = useFirstName()

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="flex flex-col gap-1 px-6 py-4">
        <Heading level="h1">
          {firstName
            ? t("qticaret.home.greeting", { name: firstName })
            : t("qticaret.home.greetingNoName")}
        </Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {t("qticaret.home.subtitle")}
        </Text>
      </Container>
      <SetupChecklist />
      <OrderNumbers />
      <QuickActions />
      <ProductNumbers />
    </div>
  )
}

// The label is a key in the namespace our strings merge into (src/admin/i18n);
// rank 0 puts it first among our menu items, which Medusa lists after its own
export const config = defineRouteConfig({
  label: "qticaret.home.title",
  translationNs: "translation",
  icon: HomeIcon,
  rank: 0,
})

export default HomePage
