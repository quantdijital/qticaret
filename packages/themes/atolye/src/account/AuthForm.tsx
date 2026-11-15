"use client"

import { ChevronDown, CircleAlert } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { AuthAction, AuthPageView } from "@qticaret/ui"
import { forgetQuickViews } from "@qticaret/ui/lib/quick-view"
import { CheckField, FieldError, TextField } from "../checkout/fields"
import type { PlaceholderWords } from "../parts/placeholders"
import { useChallengeForm } from "../frame/useChallengeForm"
import { FIELD_OF_AUTH_ERROR, firstAuthProblem, type AuthField } from "./auth-check"
import { PasswordField } from "./PasswordField"

export interface AuthFormWords {
  email: string
  password: string
  passwordHint: string
  newPassword: string
  firstName: string
  lastName: string
  phone: string
  phoneHint: string
  code: string
  accept: string
  read: string
  privacy: string
  privacyLink: string
  forgot: string
  show: string
  hide: string
  submit: string
  working: string
  checking: string
  errors: Record<string, string>
  fallback: string
  placeholders: PlaceholderWords
}

/**
 * One sign-in form, its fields by mode with the names the storefront's
 * actions read: a register's name, e-mail, mobile and password, the
 * membership text in a row that opens in place and its box; a login's
 * e-mail and password; a reset's new password; a verification's code.
 * The form looks first in the browser and says a refusal under its field,
 * the field focused; the action's answer lands the same way. A proof of
 * work the backend asks for is solved here and the form sent again.
 */
export function AuthForm({
  view,
  action,
  words,
  forgotPath,
}: {
  view: AuthPageView
  action: AuthAction
  words: AuthFormWords
  /** login: the reset form, linked under the password. */
  forgotPath?: string | undefined
}) {
  const { mode } = view
  const { error, checking, pending, onSubmit } = useChallengeForm(action)
  const [local, setLocal] = useState<{ field: AuthField; error: string } | null>(null)
  const [edited, setEdited] = useState(false)
  const form = useRef<HTMLFormElement>(null)

  // The server's refusal stands until the shopper changes something
  const served = error && !edited ? { field: FIELD_OF_AUTH_ERROR[error] ?? null, error } : null
  const problem = local ?? served
  const message = problem ? (words.errors[problem.error] ?? words.fallback) : null
  const errorOf = (field: AuthField) => (problem?.field === field ? message : null)

  useEffect(() => {
    const field = served?.field
    if (field) {
      form.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus()
    }
  }, [served?.field, error])

  const asksEmail = mode !== "reset" && !(mode === "verify" && !view.needsPassword)
  const asksPassword =
    mode === "login" || mode === "register" || mode === "reset" || mode === "verify"
  const newPassword = mode === "register" || mode === "reset"
  const terms = mode === "register" ? view.terms : null

  return (
    <form
      ref={form}
      noValidate
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget)
        const found = firstAuthProblem(
          Object.fromEntries(
            [...data.entries()].map(([key, value]) => [key, typeof value === "string" ? value : ""])
          ),
          mode
        )
        setLocal(found)
        setEdited(false)
        if (found) {
          event.preventDefault()
          event.currentTarget.querySelector<HTMLElement>(`[name="${found.field}"]`)?.focus()
          return
        }
        // The sign-in (or the code that signs in) is a soft navigation: the page lives on, and
        // the quick views kept for the guest's prices must not outlive the session
        forgetQuickViews()
        onSubmit(event)
      }}
      onChange={() => {
        setLocal(null)
        setEdited(true)
      }}
      className="flex flex-col gap-5"
    >
      {mode === "register" && (
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
          <TextField
            id="first_name"
            name="first_name"
            label={words.firstName}
            placeholder={words.placeholders.firstName}
            error={errorOf("first_name")}
            autoComplete="given-name"
            required
            maxLength={60}
          />
          <TextField
            id="last_name"
            name="last_name"
            label={words.lastName}
            placeholder={words.placeholders.lastName}
            error={errorOf("last_name")}
            autoComplete="family-name"
            required
            maxLength={60}
          />
        </div>
      )}
      {asksEmail && (
        <TextField
          id="email"
          name="email"
          type="email"
          label={words.email}
          placeholder={words.placeholders.email}
          error={errorOf("email")}
          autoComplete={mode === "register" ? "email" : "username"}
          inputMode="email"
          autoCapitalize="none"
          required
          maxLength={254}
          defaultValue={view.email ?? undefined}
        />
      )}
      {mode === "reset" && view.email && (
        // The account the link is for, for the browser's password manager; not sent
        <TextField
          id="hesap-eposta"
          type="email"
          label={words.email}
          autoComplete="username"
          readOnly
          value={view.email}
        />
      )}
      {mode === "register" && (
        <TextField
          id="phone"
          name="phone"
          type="tel"
          label={words.phone}
          placeholder={words.placeholders.phone}
          hint={words.phoneHint}
          error={errorOf("phone")}
          autoComplete="tel-national"
          inputMode="tel"
        />
      )}
      {asksPassword && (mode !== "verify" || view.needsPassword) && (
        <div className="flex flex-col">
          <PasswordField
            id="password"
            name="password"
            label={mode === "reset" ? words.newPassword : words.password}
            placeholder={newPassword ? words.placeholders.newPassword : words.placeholders.password}
            hint={newPassword ? words.passwordHint : undefined}
            error={errorOf("password")}
            autoComplete={newPassword ? "new-password" : "current-password"}
            required
            minLength={newPassword ? 10 : undefined}
            maxLength={256}
            show={words.show}
            hide={words.hide}
          />
          {forgotPath && (
            <a href={forgotPath} className="gf-link self-end text-sm">
              {words.forgot}
            </a>
          )}
        </div>
      )}
      {mode === "verify" && (
        <TextField
          id="code"
          name="code"
          label={words.code}
          placeholder={words.placeholders.code}
          error={errorOf("code")}
          autoComplete="one-time-code"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={view.token ?? undefined}
        />
      )}
      {mode === "reset" && <input type="hidden" name="token" value={view.token ?? ""} />}
      {view.next && <input type="hidden" name="next" value={view.next} />}
      {view.invite && <input type="hidden" name="davet" value={view.invite} />}
      {terms && (
        <div className="flex flex-col gap-2">
          <details className="group rounded-media bg-field">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 text-sm font-semibold">
              {terms.title}
              <span className="ml-auto text-xs font-semibold text-text-2 group-open:hidden">
                {words.read}
              </span>
              <ChevronDown
                className="size-4.5 shrink-0 text-text-2 transition-transform duration-(--dur-short) group-open:rotate-180"
                aria-hidden="true"
                strokeWidth={2}
              />
            </summary>
            {/* adr/0019: the backend's own rendering of a checked document; the box
                scrolls with nothing in it to focus, so it takes the focus (WCAG 2.1.1) */}
            <div
              role="region"
              aria-label={terms.title}
              tabIndex={0}
              className="gf-contract mx-4 mb-4 max-h-56 overflow-y-auto rounded-inner bg-paper-2 px-4 py-3 text-xs leading-relaxed text-text-2"
              dangerouslySetInnerHTML={{ __html: terms.html }}
            />
          </details>
          <input type="hidden" name="terms" value="1" />
          <CheckField
            name="accept"
            required
            aria-invalid={errorOf("accept") ? true : undefined}
            aria-describedby="accept-hata"
          >
            {words.accept}
          </CheckField>
          <FieldError id="accept-hata" message={errorOf("accept")} />
        </div>
      )}
      {mode === "register" && view.privacyPath && (
        <p className="text-sm text-text-2">
          {words.privacy}{" "}
          <a
            href={view.privacyPath}
            className="font-semibold text-text underline underline-offset-4"
          >
            {words.privacyLink}
          </a>
        </p>
      )}
      <div className="flex flex-col gap-3">
        {problem?.field === null && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-media bg-field p-4 text-sm font-semibold text-error"
          >
            <CircleAlert className="mt-0.5 size-4.5 shrink-0" aria-hidden="true" strokeWidth={2} />
            {message}
          </p>
        )}
        {/* A refusal under a field is said to a reader too, once */}
        <p role="status" className="sr-only">
          {problem && problem.field !== null ? message : null}
        </p>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className="gf-btn w-full"
        >
          {pending ? (checking ? words.checking : words.working) : words.submit}
        </button>
      </div>
    </form>
  )
}
