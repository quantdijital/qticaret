import { ValidationError } from "./errors"
import { I18N_KEY } from "./http"

interface Issue {
  message?: string
  path?: PropertyKey[]
}

/**
 * A Zod error as a ValidationError for the client: its first issue's
 * message when that is an i18n key (schemas write `seo.template_invalid`),
 * else `fallback`; the issue's path as the field, under `prefix`, or
 * `defaultField` when it has none. Anything that is not a Zod error is
 * returned as it is, to be thrown on.
 */
export function validationErrorFromZod(
  error: unknown,
  fallback: string,
  options: { prefix?: string; defaultField?: string } = {}
): unknown {
  const issue = (error as { issues?: Issue[] } | null)?.issues?.[0]
  if (!issue) {
    return error
  }
  const message = issue.message && I18N_KEY.test(issue.message) ? issue.message : fallback
  const field =
    [options.prefix, ...(issue.path ?? []).map(String)].filter(Boolean).join(".") ||
    options.defaultField
  return new ValidationError(message, field ? { field } : {})
}
