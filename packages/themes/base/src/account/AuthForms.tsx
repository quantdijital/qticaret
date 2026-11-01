"use client"

import { LoaderCircle } from "lucide-react"
import type { ReactNode } from "react"
import type { AuthAction, AuthPageView } from "@qticaret/ui"
import { Button } from "@qticaret/ui/components/button"
import { TextField } from "../checkout/fields"
import { useChallengeForm } from "./useChallengeForm"

export interface AuthWords {
  email: string
  password: string
  passwordHint: string
  newPassword: string
  firstName: string
  lastName: string
  phone: string
  phoneOptional: string
  code: string
  accept: string
  submit: string
  working: string
  checking: string
  errors: Record<string, string>
  fallback: string
}

/** One sign-in form: its fields by mode, the button, the refusal in words. */
export function AuthForm({
  view,
  action,
  words,
  children,
}: {
  view: AuthPageView
  action: AuthAction
  words: AuthWords
  children?: ReactNode
}) {
  const { error, checking, pending, onSubmit } = useChallengeForm(action)
  const { mode } = view
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {mode === "register" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="first_name"
            name="first_name"
            label={words.firstName}
            autoComplete="given-name"
            required
            maxLength={60}
          />
          <TextField
            id="last_name"
            name="last_name"
            label={words.lastName}
            autoComplete="family-name"
            required
            maxLength={60}
          />
        </div>
      )}
      {mode !== "reset" && !(mode === "verify" && !view.needsPassword) && (
        <TextField
          id="email"
          name="email"
          type="email"
          label={words.email}
          autoComplete={mode === "register" ? "email" : "username"}
          required
          defaultValue={view.email ?? undefined}
        />
      )}
      {mode === "register" && (
        <TextField
          id="phone"
          name="phone"
          type="tel"
          label={`${words.phone} ${words.phoneOptional}`}
          autoComplete="tel-national"
          inputMode="tel"
        />
      )}
      {(mode === "login" ||
        mode === "register" ||
        mode === "reset" ||
        (mode === "verify" && view.needsPassword)) && (
        <TextField
          id="password"
          name="password"
          type="password"
          label={mode === "reset" ? words.newPassword : words.password}
          hint={mode === "register" || mode === "reset" ? words.passwordHint : undefined}
          autoComplete={mode === "login" || mode === "verify" ? "current-password" : "new-password"}
          required
          minLength={mode === "register" || mode === "reset" ? 10 : undefined}
          maxLength={256}
        />
      )}
      {mode === "verify" && (
        <TextField
          id="code"
          name="code"
          label={words.code}
          required
          autoComplete="one-time-code"
          defaultValue={view.token ?? undefined}
        />
      )}
      {mode === "reset" && <input type="hidden" name="token" value={view.token ?? ""} />}
      {view.next && <input type="hidden" name="next" value={view.next} />}
      {view.invite && <input type="hidden" name="davet" value={view.invite} />}
      {children}
      {mode === "register" && view.terms && (
        <>
          <input type="hidden" name="terms" value="1" />
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="accept"
              required
              className="mt-0.5 size-4.5 shrink-0 accent-foreground"
            />
            <span>{words.accept}</span>
          </label>
        </>
      )}
      <p role="alert" className="text-sm font-medium text-sale empty:hidden">
        {error ? (words.errors[error] ?? words.fallback) : null}
      </p>
      <Button type="submit" size="lg" disabled={pending} className="h-12 rounded-full text-[15px]">
        {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {pending ? (checking ? words.checking : words.working) : words.submit}
      </Button>
    </form>
  )
}
