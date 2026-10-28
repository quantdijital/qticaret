import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { parseEnv } from "../../lib/env"
import { ValidationError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { isProviderError } from "../../lib/errors"
import { platformSender } from "../../lib/messaging/email"
import { createResendDomains } from "../../lib/messaging/email/resend-domains"
import type { ResendDomain, ResendDomains } from "../../lib/messaging/email/resend-domains"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"

type Container = Pick<MedusaContainer, "resolve">

const STATUSES = ["not_started", "pending", "verified", "failure", "temporary_failure"] as const
type DomainStatus = (typeof STATUSES)[number]

const statusOf = (value: string): DomainStatus =>
  (STATUSES as readonly string[]).includes(value) ? (value as DomainStatus) : "pending"

/** Resend's domains on this instance; null where e-mail does not go through Resend (Mailpit). */
export function resendDomains(): ResendDomains | null {
  const env = parseEnv()
  return env.EMAIL_TRANSPORT === "resend" && env.RESEND_API_KEY
    ? createResendDomains(
        env.RESEND_API_KEY,
        env.RESEND_BASE_URL ? { baseUrl: env.RESEND_BASE_URL } : {}
      )
    : null
}

const requireDomains = (): ResendDomains => {
  const domains = resendDomains()
  if (!domains) {
    throw new ValidationError("messaging.domains_unavailable")
  }
  return domains
}

const messagingOf = (container: Container) =>
  container.resolve<MessagingModuleService>(MESSAGING_MODULE)

export async function currentSenderDomain(container: Container) {
  const [row] = await messagingOf(container).listSenderDomains({}, { take: 1 })
  return row ?? null
}

/** Who the shop's e-mail is from: its own verified domain, else the platform's address. */
export async function senderAddress(container: Container): Promise<string | null> {
  const domain = await currentSenderDomain(container)
  return domain?.status === "verified" ? `${domain.local_part}@${domain.name}` : platformSender()
}

/** Resend no longer has it: removed there already, by hand or by an earlier attempt. */
const goneAtResend = (error: unknown): boolean =>
  isProviderError(error) && ["not_found", "http_404"].includes(error.providerCode)

/** A shop has one sender domain: a second is refused before Resend hears of it. */
const requireNoSenderDomainStep = createStep(
  "messaging-require-no-sender-domain",
  async (_input: undefined, { container }) => {
    if (await currentSenderDomain(container)) {
      throw new ValidationError("messaging.domain_exists")
    }
    return new StepResponse(undefined)
  }
)

/** Adds the domain at Resend; undone by removing it there when the record cannot be kept. */
const addResendDomainStep = createStep(
  "messaging-add-resend-domain",
  async (input: { name: string }) => {
    const created = await requireDomains().create(input.name)
    return new StepResponse(created, created.id)
  },
  async (resendId) => {
    if (resendId) {
      await requireDomains()
        .remove(resendId)
        .catch((error: unknown) => {
          // The id lets someone remove it at Resend by hand
          logger.warn({
            event: "messaging.domain_withdraw_failed",
            resend_id: resendId,
            err: errorSummary(error),
          })
        })
    }
  }
)

const saveSenderDomainStep = createStep(
  "messaging-save-sender-domain",
  async (input: { domain: ResendDomain; local_part: string }, { container }) => {
    if (await currentSenderDomain(container)) {
      throw new ValidationError("messaging.domain_exists")
    }
    const saved = await messagingOf(container).createSenderDomains({
      name: input.domain.name.toLowerCase(),
      local_part: input.local_part,
      resend_id: input.domain.id,
      status: statusOf(input.domain.status),
      records: (input.domain.records ?? []) as unknown as Record<string, unknown>,
      checked_at: new Date(),
    })
    return new StepResponse(saved, saved.id)
  },
  async (id, { container }) => {
    if (id) {
      await messagingOf(container).deleteSenderDomains([id])
    }
  }
)

/** The shop's sender domain (F9.6): added at Resend, kept with the records to publish. */
export const addSenderDomainWorkflow = createWorkflow(
  "messaging-add-sender-domain",
  (input: { name: string; local_part: string }) => {
    requireNoSenderDomainStep()
    const domain = addResendDomainStep({ name: input.name })
    return new WorkflowResponse(saveSenderDomainStep({ domain, local_part: input.local_part }))
  }
)

/** Asks Resend to look at the DNS again and keeps what it says. */
export async function checkSenderDomain(container: Container) {
  const domain = await currentSenderDomain(container)
  if (!domain) {
    throw new ValidationError("messaging.domain_missing")
  }
  const domains = requireDomains()
  await domains.verify(domain.resend_id)
  const read = await domains.get(domain.resend_id)
  const status = statusOf(read.status)
  return messagingOf(container).updateSenderDomains({
    id: domain.id,
    status,
    records: (read.records ?? []) as unknown as Record<string, unknown>,
    checked_at: new Date(),
    verified_at: status === "verified" ? (domain.verified_at ?? new Date()) : null,
  })
}

/** Removes the domain at Resend and here; e-mail goes from the platform's address again. */
export async function removeSenderDomain(container: Container) {
  const domain = await currentSenderDomain(container)
  if (!domain) {
    return
  }
  await requireDomains()
    .remove(domain.resend_id)
    .catch((error: unknown) => {
      if (!goneAtResend(error)) {
        throw error
      }
    })
  await messagingOf(container).deleteSenderDomains([domain.id])
}
