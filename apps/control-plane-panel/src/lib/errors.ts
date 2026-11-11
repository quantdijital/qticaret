import type { TFunction } from "i18next"
import { isApiError } from "./api"
import { isStepUpCancelled } from "./step-up"

/**
 * The control plane's stable refusal keys (adr/0061 Ek C4) this panel puts
 * into words: `errors.cp.<name>` in the locale files. A unit test keeps
 * both languages in step with this list.
 */
export const CP_ERROR_CODES = [
  "audit_kind_invalid",
  "audit_unavailable",
  "challenge_unknown",
  "contact_unknown",
  "contacts_full",
  "deactivate_self",
  "domain_invalid",
  "domain_platform",
  "domain_platform_kept",
  "domain_taken",
  "domain_unknown",
  "domain_unverified",
  "domains_full",
  "email_invalid",
  "enrolment_token_invalid",
  "forbidden",
  "invite_failed",
  "invite_invalid",
  "invite_login",
  "invite_member",
  "invite_pending",
  "last_owner",
  "member_unknown",
  "mfa_already_enabled",
  "mfa_code_invalid",
  "mfa_code_used",
  "mfa_not_started",
  "mfa_required",
  "mfa_start_failed",
  "name_invalid",
  "name_required",
  "no_role",
  "not_staff",
  "note_not_yours",
  "note_required",
  "note_too_long",
  "note_unknown",
  "nothing_to_save",
  "override_expired",
  "override_unknown",
  "owner_exists",
  "package_archived",
  "package_code_invalid",
  "package_code_taken",
  "package_unknown",
  "password_invalid",
  "phone_invalid",
  "postal_code_invalid",
  "reason_required",
  "register_closed",
  "reset_self",
  "session_required",
  "session_revoked",
  "session_unknown",
  "sign_in_locked",
  "signing_next_exists",
  "signing_no_next",
  "signing_no_previous",
  "signing_previous_pending",
  "slug_invalid",
  "slug_reserved",
  "slug_taken",
  "status_transition",
  "step_up_failed",
  "step_up_invalid",
  "step_up_locked",
  "step_up_required",
  "tckn_company",
  "tckn_invalid",
  "tckn_none",
  "tckn_unreadable",
  "tenant_unknown",
  "text_invalid",
  "vkn_invalid",
] as const

// The control plane's generic keys (its middlewares): `errors.api.<name>`
export const API_ERROR_CODES = [
  "csrf_rejected",
  "invalid_request",
  "not_found",
  "too_many_requests",
] as const

// The password rule shared with the shop (server-kit, adr/0043): `errors.password.<problem>`
export const PASSWORD_PROBLEMS = ["too_short", "too_long", "common", "contains_email"] as const

const CP_KEY = /\bcp\.([a-z_]+)\b/
const PASSWORD_KEY = /\bauth\.password_([a-z_]+)\b/
const API_KEY = /^errors\.([a-z_]+)$/

const known = <T extends string>(list: readonly T[], name: string | undefined): name is T =>
  name !== undefined && (list as readonly string[]).includes(name)

/**
 * The key that names a failure in this panel's words, or null: a `cp.*`
 * key (alone, or inside a validation message: Medusa writes a body's
 * failed fields into one sentence) or one of the control plane's generic
 * ones.
 */
export function errorKey(error: unknown): string | null {
  if (!isApiError(error)) {
    return null
  }
  const cp = CP_KEY.exec(error.code)?.[1]
  if (known(CP_ERROR_CODES, cp)) {
    return `errors.cp.${cp}`
  }
  const password = PASSWORD_KEY.exec(error.code)?.[1]
  if (known(PASSWORD_PROBLEMS, password)) {
    return `errors.password.${password}`
  }
  const generic = API_KEY.exec(error.code)?.[1]
  if (known(API_ERROR_CODES, generic)) {
    return `errors.api.${generic}`
  }
  return null
}

// By status, when the answer named nothing this panel knows (Medusa's own sentence)
const BY_STATUS: Record<number, string> = {
  400: "errors.status.400",
  401: "errors.status.401",
  403: "errors.status.403",
  404: "errors.status.404",
  409: "errors.status.409",
  429: "errors.status.429",
}

/**
 * A failure as Turkish text: the control plane's key in words, else what
 * its status means; a network failure, a 5xx or a script error is the
 * generic line, so nothing internal reaches the screen.
 */
export function errorText(t: TFunction, error: unknown): string {
  if (isStepUpCancelled(error)) {
    return t("stepUp.cancelled")
  }
  const key = errorKey(error)
  if (key) {
    return t(key)
  }
  if (isApiError(error)) {
    const byStatus = BY_STATUS[error.status]
    if (byStatus) {
      return t(byStatus)
    }
  }
  return t("errors.generic")
}
