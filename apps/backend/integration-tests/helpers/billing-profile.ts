import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BILLING_PROFILE_MODULE } from "../../src/modules/billing-profile"
import type BillingProfileModuleService from "../../src/modules/billing-profile/service"
import type { TestCustomer } from "./customer"
import type { HttpClient, HttpResponse } from "./http"
import { settle } from "./http"

// Algorithmically valid test numbers, not real people or companies
export const TCKN = "10000000146"
export const VKN = "1234567890"

export const INDIVIDUAL = { type: "individual", legal_name: "Ayşe Yılmaz", tax_id: TCKN }
export const CORPORATE = {
  type: "corporate",
  legal_name: "Örnek Ticaret A.Ş.",
  tax_office: "Kadıköy",
  tax_id: VKN,
}

export interface ProfileResponse {
  billing_profile: { id: string; type: string; tax_id_masked: string } | null
}

export function billingProfileService(container: MedusaContainer): BillingProfileModuleService {
  return container.resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
}

export function saveProfile(
  http: HttpClient,
  customer: TestCustomer,
  body: unknown
): Promise<HttpResponse<ProfileResponse>> {
  return settle(
    http.post<ProfileResponse>("/store/customers/me/billing-profile", body, {
      headers: customer.headers,
    })
  )
}

/** Text of every row in tables that could hold the tax id. */
export async function storedText(container: MedusaContainer): Promise<string> {
  const db = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const profiles: unknown[] = await db.select("*").from("billing_profile")
  const executions: unknown[] = await db.select("*").from("workflow_execution")
  return JSON.stringify([profiles, executions])
}
