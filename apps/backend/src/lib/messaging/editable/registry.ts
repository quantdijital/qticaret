import { MESSAGE_TEMPLATES } from "../templates"
import type { MessageTemplate } from "../templates/types"
import { MESSAGE_GROUPS } from "./types"

type Editable = MessageTemplate<unknown> & Required<Pick<MessageTemplate<unknown>, "editable">>

const groupRank = (template: Editable): number => MESSAGE_GROUPS.indexOf(template.editable.group)

/**
 * The customer messages the shop may reword (adr/0036 Ek 2026-11-10), by
 * group and then as the registry lists them. Not the team's alerts, nor
 * campaigns and announcements, whose body is written for each send.
 */
export const EDITABLE_TEMPLATES: readonly Editable[] = (
  Object.values(MESSAGE_TEMPLATES) as MessageTemplate<unknown>[]
)
  .filter((template): template is Editable => template.editable !== undefined)
  .sort((a, b) => groupRank(a) - groupRank(b))

/** The editable template of that name; own keys only, so `constructor` is none. */
export function editableTemplate(name: string): Editable | null {
  if (!Object.hasOwn(MESSAGE_TEMPLATES, name)) {
    return null
  }
  const template = MESSAGE_TEMPLATES[name as keyof typeof MESSAGE_TEMPLATES] as
    MessageTemplate<unknown> | undefined
  return template?.editable ? (template as Editable) : null
}
