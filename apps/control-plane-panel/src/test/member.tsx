import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import type { ReactElement } from "react"
import { ME_KEY } from "@/features/auth/api"
import type { Me, StaffRole } from "@/features/auth/api"

export const memberAs = (role: StaffRole, id = "user_me"): Me => ({
  id,
  email: "uye@quant.test",
  first_name: "Deniz",
  last_name: "Kaya",
  role,
  pending: false,
  enrol_by: null,
  enrolment_token_required: false,
  mfa: { required: true, enabled: true, passed: true },
})

/** The page as a signed-in member in `role` sees it (the member already in the query cache). */
export function renderAs(ui: ReactElement, role: StaffRole, id?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  })
  client.setQueryData(ME_KEY, memberAs(role, id))
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) }
}
