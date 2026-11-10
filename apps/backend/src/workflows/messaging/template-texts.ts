import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../lib/logging"
import { checkOwnTexts, ownTextsOf } from "../../lib/messaging/editable/check"
import type { CheckedTexts, TextsInput } from "../../lib/messaging/editable/check"
import { EDITABLE_TEMPLATES, editableTemplate } from "../../lib/messaging/editable/registry"
import { defaultText, tokenValues } from "../../lib/messaging/editable/texts"
import { traitsOf } from "../../lib/messaging/editable/tokens"
import { TEXT_FIELDS } from "../../lib/messaging/editable/types"
import type { MessageGroup, OwnTexts, TextField } from "../../lib/messaging/editable/types"
import { previewVars } from "../../lib/messaging/preview"
import type { MessageChannel } from "../../lib/messaging/recipients"
import type { MessageKind } from "../../lib/messaging/templates"
import { MESSAGING_MODULE } from "../../modules/messaging"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { MarketingSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import type MessagingModuleService from "../../modules/messaging/service"
import type { TemplateTextRow } from "../../modules/messaging/types"
import { previewFactsOf } from "./preview"

type Container = Pick<MedusaContainer, "resolve">

const messagingOf = (container: Container) =>
  container.resolve<MessagingModuleService>(MESSAGING_MODULE)

const checkedOf = (row: TemplateTextRow | null): CheckedTexts | null =>
  row
    ? {
        enabled: row.enabled,
        subject: row.subject,
        preheader: row.preheader,
        heading: row.heading,
        intro: row.intro,
        sms: row.sms,
      }
    : null

/** One customer message as the panel lists and edits it (adr/0036 Ek 2026-11-10). */
export interface CustomerMessageView {
  name: string
  kind: MessageKind
  channels: readonly MessageChannel[]
  group: MessageGroup
  /** Where it is turned on and off: here, nowhere (required), or with its feature's switch. */
  switch: "here" | "required" | "marketing"
  /** Whether it goes; a required one always does. */
  enabled: boolean
  /**
   * The `{belirteç}`s it offers: what each says in the preview, at its
   * longest (the SMS is counted with it, as the save counts), whether it
   * can be empty in a send, and whether a person typed it (UCS-2 risk).
   */
  tokens: {
    name: string
    sample: string
    longest: string
    may_be_empty: boolean
    free_text: boolean
  }[]
  /** Each field the shop may write: the platform's text, the shop's own, the tokens it must keep. */
  fields: {
    field: TextField
    default: string
    text: string | null
    required_tokens: readonly string[]
  }[]
}

/** Every customer message, grouped, with the shop's words beside the platform's. */
export async function customerMessageViews(container: Container): Promise<CustomerMessageView[]> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [{ brand, facts }, rows, marketing] = await Promise.all([
    previewFactsOf(container),
    messagingOf(container).templateTexts(),
    settings.getSection("marketing") as Promise<unknown> as Promise<MarketingSettings>,
  ])
  const byName = new Map(rows.map((row) => [row.template, row]))
  return EDITABLE_TEMPLATES.map((template) => {
    const spec = template.editable
    const sample = previewVars(template, facts)
    const row = byName.get(template.name) ?? null
    const samples = tokenValues(spec, sample, brand)
    const switched = spec.required ? "required" : (spec.switchedIn ?? "here")
    return {
      name: template.name,
      kind: template.kind,
      channels: template.channels,
      group: spec.group,
      switch: switched,
      enabled:
        switched === "required" ||
        (switched === "marketing" ? marketing.abandoned_cart_enabled : (row?.enabled ?? true)),
      tokens: Object.keys(spec.tokens).map((name) => {
        const value = samples[name] ?? ""
        const traits = traitsOf(name)
        const worst = traits.longest ?? ""
        return {
          name,
          sample: value,
          longest: worst.length > value.length ? worst : value,
          may_be_empty: traits.mayBeEmpty ?? false,
          free_text: traits.freeText ?? false,
        }
      }),
      fields: TEXT_FIELDS.filter((field) => spec.fields[field] !== undefined).map((field) => ({
        field,
        default: defaultText(spec, field, sample),
        text: row?.[field] ?? null,
        required_tokens: spec.mustContain?.[field] ?? [],
      })),
    }
  })
}

/** The one message's view; 404 for a name that is no customer message. */
export async function customerMessageView(
  container: Container,
  name: string
): Promise<CustomerMessageView> {
  const view = (await customerMessageViews(container)).find((each) => each.name === name)
  if (!view) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "messaging.template_unknown")
  }
  return view
}

/** What a send uses: whether the shop turned the message off, and its own words. */
export interface SendTexts {
  off: boolean
  own: OwnTexts
}

/**
 * The shop's words for a template at send time. A read that fails sends
 * the platform's words rather than nothing: the message matters more.
 */
export async function sendTextsOf(container: Container, name: string): Promise<SendTexts> {
  const template = editableTemplate(name)
  if (!template) {
    return { off: false, own: {} }
  }
  try {
    const row = await messagingOf(container).templateTextOf(name)
    const { required, switchedIn } = template.editable
    return {
      off: !required && !switchedIn && row?.enabled === false,
      own: ownTextsOf(checkedOf(row)),
    }
  } catch (error) {
    logger.warn({ event: "messaging.texts_unread", template: name, err: errorSummary(error) })
    return { off: false, own: {} }
  }
}

/** A draft checked as a save would check it, over what is kept now; nothing is saved. */
export async function checkDraftTexts(
  container: Container,
  name: string,
  input: TextsInput
): Promise<CheckedTexts> {
  const template = editableTemplate(name)
  if (!template) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "messaging.template_unknown")
  }
  const [{ brand, facts }, row] = await Promise.all([
    previewFactsOf(container),
    messagingOf(container).templateTextOf(name),
  ])
  return checkOwnTexts(template, input, checkedOf(row), previewVars(template, facts), brand)
}

export interface SaveTemplateTextsInput {
  template: string
  values: TextsInput
  actor_id: string | null
}

interface Saved {
  template: string
  before: TemplateTextRow | null
}

/** Checks and keeps the shop's words; undone, the words before come back. */
export const saveTemplateTextsStep = createStep(
  "messaging-save-template-texts",
  async (input: SaveTemplateTextsInput, { container }) => {
    const messaging = messagingOf(container)
    const before = await messaging.templateTextOf(input.template)
    const checked = await checkDraftTexts(container, input.template, input.values)
    await messaging.saveTemplateText(input.template, checked, input.actor_id)
    return new StepResponse<undefined, Saved>(undefined, { template: input.template, before })
  },
  async (saved, { container }) => {
    if (!saved) {
      return
    }
    const previous = checkedOf(saved.before) ?? { enabled: true, ...emptyTexts() }
    await messagingOf(container).saveTemplateText(
      saved.template,
      previous,
      saved.before?.updated_by ?? null
    )
  }
)

const emptyTexts = (): Record<TextField, null> =>
  Object.fromEntries(TEXT_FIELDS.map((field) => [field, null])) as Record<TextField, null>

/** A customer message reworded or turned on or off (adr/0036 Ek 2026-11-10). */
export const saveTemplateTextsWorkflow = createWorkflow(
  "messaging-save-template-texts",
  (input: SaveTemplateTextsInput) => new WorkflowResponse(saveTemplateTextsStep(input))
)
