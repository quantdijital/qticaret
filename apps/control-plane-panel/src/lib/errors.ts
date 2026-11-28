import type { TFunction } from "i18next"
import { isApiError } from "./api"
import { isStepUpCancelled } from "./step-up"

/**
 * The control plane's stable refusal keys (adr/0061 Ek C4) this panel puts
 * into words: `errors.cp.<name>` in the locale files. A unit test keeps
 * both languages in step with this list.
 */
export const CP_ERROR_CODES = [
  // The AI credits' (adr/0085): their validators, the module's inputs, ai-conflicts.ts
  "ai_credit_actor_invalid",
  "ai_credit_actor_required",
  "ai_credit_amount_invalid",
  "ai_credit_balance_short",
  "ai_credit_bucket_invalid",
  "ai_credit_daily_cap_invalid",
  "ai_credit_grant_ref_conflict",
  "ai_credit_grant_ref_invalid",
  "ai_credit_grant_ref_reserved",
  "ai_credit_key_invalid",
  "ai_credit_note_invalid",
  "ai_credit_note_required",
  "ai_credit_order_closed",
  "ai_credit_order_not_found",
  "ai_credit_order_pending",
  "ai_credit_reference_invalid",
  "ai_credit_requested_by_invalid",
  "ai_credit_setting_missing",
  "ai_credit_wallet_missing",
  "ai_credit_wallet_stale",
  "ai_credit_write_refused",
  "ai_key_invalid",
  "ai_pack_duplicate",
  "ai_pack_invalid",
  "ai_pack_unknown",
  "ai_packs_too_many",
  "ai_route_capability_unknown",
  "ai_route_capability_unsupported",
  "ai_route_model_not_allowed",
  "ai_route_no_key",
  "ai_route_service_unknown",
  "ai_route_uncapped",
  "ai_route_unverified",
  "ai_service_unknown",
  "amount_zero",
  "audit_kind_invalid",
  "audit_unavailable",
  "challenge_unknown",
  "charge_not_open",
  "charge_unknown",
  "contact_unknown",
  "contacts_full",
  "day_invalid",
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
  "limit_grant_unlimited",
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
  "paid_on_future",
  "paid_on_too_early",
  "password_invalid",
  "phone_invalid",
  "postal_code_invalid",
  "preset_unknown",
  "provisioner_unavailable",
  "provisioning_busy",
  "reason_required",
  "register_closed",
  "release_commit_invalid",
  "release_unknown",
  "release_version_invalid",
  "release_version_reserved",
  "release_version_taken",
  "reset_self",
  "run_unknown",
  "sector_pack_unknown",
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
  "subscription_unknown",
  "support_no_panel",
  "support_reason_required",
  "support_unavailable",
  "tckn_company",
  "tckn_invalid",
  "tckn_none",
  "tckn_unreadable",
  "tenant_closed",
  "tenant_unknown",
  "text_invalid",
  "vkn_invalid",
] as const

/**
 * The control plane's `provisioning.*` codes this panel puts into words:
 * `errors.provisioning.<name>` in the locale files (a unit test keeps both
 * languages in step). A command's own failure is `<command>_failed` or
 * `<command>_timeout`.
 */
export const PROVISIONING_CODES = [
  "api_url_refused",
  "apply_pack_failed",
  "apply_pack_result_invalid",
  "apply_pack_timeout",
  "apply_preset_failed",
  "apply_preset_result_invalid",
  "apply_preset_timeout",
  "apply_profile_failed",
  "apply_profile_result_invalid",
  "apply_profile_timeout",
  "backend_not_built",
  "bootstrap_failed",
  "bootstrap_timeout",
  "build_stale",
  "command_unavailable",
  "database_failed",
  "database_name_invalid",
  "env_value_invalid",
  "finish_failed",
  "foreign_shop",
  "health_timeout",
  "injected_failure",
  "interrupted",
  "invite_failed",
  "invite_owner_failed",
  "invite_owner_timeout",
  "invite_token_invalid",
  "local_database_elsewhere",
  "local_development_only",
  "mail_failed",
  "mail_off",
  "migrate_failed",
  "migrate_timeout",
  "no_owner_contact",
  "no_package",
  "no_panel_host",
  "no_plan_document",
  "no_port",
  "no_signing_key",
  "owner_address_taken",
  "owner_email_invalid",
  "plan_import_failed",
  "plan_import_refused",
  "plan_import_timeout",
  "port_in_use",
  "preset_unknown",
  "repo_unknown",
  "secrets_exposed",
  "secrets_lost",
  "secrets_missing",
  "secrets_orphaned",
  "sector_pack_unknown",
  "shop_exited",
  "shop_running",
  "slug_invalid",
  "start_failed",
  "step_failed",
  "store_name_invalid",
  "tenant_status",
] as const

// The control plane's generic keys (its middlewares): `errors.api.<name>`
export const API_ERROR_CODES = [
  "csrf_rejected",
  "invalid_request",
  "not_found",
  "too_many_requests",
] as const

// The AI credits' tenant-facing keys (adr/0085): `errors.ai_credits.<name>`
export const AI_CREDITS_CODES = ["pack_unknown", "unavailable"] as const

// The password rule shared with the shop (server-kit, adr/0043): `errors.password.<problem>`
export const PASSWORD_PROBLEMS = ["too_short", "too_long", "common", "contains_email"] as const

const CP_KEY = /\bcp\.([a-z_]+)\b/
const PASSWORD_KEY = /\bauth\.password_([a-z_]+)\b/
const API_KEY = /^errors\.([a-z_]+)$/
const PROVISIONING_KEY = /^provisioning\.([a-z_]+)$/
const AI_CREDITS_KEY = /\bai_credits\.([a-z_]+)\b/

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
  const provisioning = PROVISIONING_KEY.exec(error.code)?.[1]
  if (known(PROVISIONING_CODES, provisioning)) {
    return `errors.provisioning.${provisioning}`
  }
  const aiCredits = AI_CREDITS_KEY.exec(error.code)?.[1]
  if (known(AI_CREDITS_CODES, aiCredits)) {
    return `errors.ai_credits.${aiCredits}`
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
