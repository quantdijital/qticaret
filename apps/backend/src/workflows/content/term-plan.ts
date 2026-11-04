import type { MedusaContainer } from "@medusajs/framework/types"
import { ValidationError } from "../../lib/errors"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import type { ContentTermKind, ContentTermRecord } from "../../modules/content/service"
import { handleOf } from "./handle"
import { lineOf } from "./rules"

/**
 * What a blog category or tag may hold (adr/0019 ek 2026-11-03): a clean
 * name, a slug handle one term of its kind has (from the name unless
 * given), an optional plain description and a rank.
 */

export const TERM_LIMITS = { name: 120, description: 1000 } as const

export interface TermInput {
  name?: string | undefined
  handle?: string | undefined
  description?: string | null | undefined
  rank?: number | undefined
}

export interface TermFields {
  kind: ContentTermKind
  name: string
  handle: string
  description: string | null
  rank: number
}

function descriptionOf(input: TermInput, current: ContentTermRecord | null): string | null {
  if (input.description === undefined) {
    return current?.description ?? null
  }
  const text = input.description?.trim() ?? ""
  return text === ""
    ? null
    : lineOf(text, TERM_LIMITS.description, "content.term_description_invalid")
}

/** The term as it will be stored; a handle another term of its kind holds is refused. */
export async function termPlan(
  container: MedusaContainer,
  kind: ContentTermKind,
  input: TermInput,
  current: ContentTermRecord | null
): Promise<TermFields> {
  const name = lineOf(
    input.name ?? current?.name ?? "",
    TERM_LIMITS.name,
    "content.term_name_invalid"
  )
  if (name === "") {
    throw new ValidationError("content.term_name_invalid", { field: "name" })
  }
  const handle =
    input.handle === undefined && current ? current.handle : handleOf(input.handle, name)
  const taken = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listContentTerms({ kind, handle }, { select: ["id"] })
  if (taken.some((term) => term.id !== current?.id)) {
    throw new ValidationError("content.term_handle_taken", { field: "handle" })
  }
  return {
    kind,
    name,
    handle,
    description: descriptionOf(input, current),
    rank: input.rank ?? current?.rank ?? 0,
  }
}
