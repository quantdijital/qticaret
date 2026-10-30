import { createFileRoute, redirect } from "@tanstack/react-router"
import { isLegalKind } from "@/features/legal/api"
import { LegalKindPage } from "@/features/legal/pages/legal-kind-page"

export const Route = createFileRoute("/_auth/settings/legal/$kind")({
  // A mistyped address opens the list
  beforeLoad: ({ params }) => {
    if (!isLegalKind(params.kind)) {
      throw redirect({ to: "/settings/legal" })
    }
  },
  component: LegalKindPage,
})
