import type { MedusaRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { isCredentialProvider } from "../../../../modules/integration-credentials/providers"
import type { CredentialProviderName } from "../../../../modules/integration-credentials/providers"

/** The provider in the path; one the shop cannot connect is 404. */
export function providerParam(req: MedusaRequest): CredentialProviderName {
  const provider = req.params["provider"] ?? ""
  if (!isCredentialProvider(provider)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "integration_credentials.unknown_provider")
  }
  return provider
}
