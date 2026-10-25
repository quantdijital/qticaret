import { z } from "zod"
import { QUERY_POLICIES, REDIRECT_MATCHES } from "@/features/seo/api/redirects"
import type { Redirect, RedirectInput, RedirectStatus } from "@/features/seo/api/redirects"

/**
 * The redirect form (adr/0017). The panel checks what it can see (a path,
 * a target unless 410); the server checks the rest against the shop's
 * pages and rules (loops, live pages, chains) and answers in a sentence.
 */

const PATH_OR_URL = /^(\/|https?:\/\/)/i

export const redirectSchema = z
  .object({
    match: z.enum(REDIRECT_MATCHES),
    source: z
      .string()
      .trim()
      .min(1, "seo.redirects.form.sourceRequired")
      .max(2048)
      .regex(PATH_OR_URL, "seo.redirects.form.sourceSlash"),
    status: z.enum(["301", "302", "307", "410"]),
    target: z.string().trim().max(2048),
    query_policy: z.enum(QUERY_POLICIES),
    query_keep: z.string().max(600),
  })
  .superRefine((values, context) => {
    if (values.status !== "410" && !values.target.startsWith("/")) {
      context.addIssue({
        code: "custom",
        path: ["target"],
        message: values.target
          ? "seo.redirects.form.targetSlash"
          : "seo.redirects.form.targetRequired",
      })
    }
    if (values.query_policy === "keep_list" && keepList(values.query_keep).length === 0) {
      context.addIssue({
        code: "custom",
        path: ["query_keep"],
        message: "seo.redirects.form.keepRequired",
      })
    }
  })

export type RedirectForm = z.infer<typeof redirectSchema>

const keepList = (text: string): string[] =>
  [...new Set(text.split(/[\s,|]+/).filter(Boolean))].slice(0, 20)

export const EMPTY_REDIRECT: RedirectForm = {
  match: "exact",
  source: "",
  status: "301",
  target: "",
  query_policy: "keep",
  query_keep: "",
}

export function formOf(rule: Redirect): RedirectForm {
  return {
    match: rule.match,
    source: rule.match === "prefix" ? `${rule.source}/*` : rule.source,
    status: String(rule.status) as RedirectForm["status"],
    target: rule.target ?? "",
    query_policy: rule.query_policy,
    query_keep: rule.query_keep.join(", "),
  }
}

export function inputOf(values: RedirectForm): RedirectInput {
  const status = Number(values.status) as RedirectStatus
  return {
    match: values.match,
    source: values.source,
    status,
    target: status === 410 ? null : values.target,
    query_policy: values.query_policy,
    query_keep: values.query_policy === "keep_list" ? keepList(values.query_keep) : [],
  }
}
