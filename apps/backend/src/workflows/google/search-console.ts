import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../lib/errors"
import { googleApi } from "../../lib/google/client"
import { SEARCH_CONSOLE_SCOPE, googleClientOf } from "../../lib/google/oauth"
import { searchConsoleApi } from "../../lib/google/search-console"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"

const credentialsOf = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)

// What Search Console grants: an unverified user reads nothing
const READABLE = new Set(["siteOwner", "siteFullUser", "siteRestrictedUser"])

/**
 * The Search Console properties the shop's Google account can read
 * (F10.11); an error when it is not connected, or connected before Search
 * Console was asked for.
 */
export async function searchConsoleSites(
  container: Pick<MedusaContainer, "resolve">
): Promise<{ siteUrl: string; permission: string }[]> {
  const client = googleClientOf()
  const account = await credentialsOf(container).read("google")
  const refreshToken = account?.secrets["refresh_token"]
  const scopes = account?.settings["scopes"]
  if (!client || !refreshToken) {
    throw new ValidationError("google.not_connected")
  }
  if (typeof scopes !== "string" || !scopes.split(" ").includes(SEARCH_CONSOLE_SCOPE)) {
    throw new ValidationError("google.search_console_scope")
  }
  const token = await googleApi().accessToken(client, refreshToken)
  return (await searchConsoleApi().listSites(token)).filter((site) => READABLE.has(site.permission))
}

/**
 * Names the shop's Search Console property: one the account can read.
 * Undone by putting the connection back as it was.
 */
const saveSearchConsoleSiteStep = createStep(
  "google-save-search-console-site",
  async (input: { site: string; user_id: string }, { container }) => {
    const sites = await searchConsoleSites(container)
    if (!sites.some((each) => each.siteUrl === input.site)) {
      throw new ValidationError("google.gsc_site_invalid", { field: "site" })
    }
    const credentials = credentialsOf(container)
    const current = await credentials.read("google")
    const draft = await credentials.draft("google", {
      settings: { ...(current?.settings ?? {}), gsc_site: input.site },
    })
    const previous = await credentials.store(draft, null, input.user_id)
    return new StepResponse({ site: input.site }, { previous })
  },
  async (undo, { container }) => {
    if (undo) {
      await credentialsOf(container).restore("google", undo.previous)
    }
  }
)

export const saveSearchConsoleSiteWorkflow = createWorkflow(
  "google-save-search-console-site",
  (input: { site: string; user_id: string }) =>
    new WorkflowResponse(saveSearchConsoleSiteStep(input))
)
