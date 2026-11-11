import { createFileRoute } from "@tanstack/react-router"
import { PackagesPage } from "@/features/packages/pages/packages-page"

/** The platform's packages (adr/0061 §2): every role reads them; owner and finance change them. */
export const Route = createFileRoute("/_app/packages")({
  component: PackagesPage,
})
