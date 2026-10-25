import { createFileRoute } from "@tanstack/react-router"
import { navItem } from "@/components/layout/navigation"
import { UpcomingPage } from "@/components/patterns/upcoming-page"

// Replaced by its panel screen (docs/03 panel hattı)
export const Route = createFileRoute("/_auth/customers")({
  component: () => <UpcomingPage item={navItem("customers")} />,
})
