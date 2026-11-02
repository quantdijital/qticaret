"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import type { ChallengeResult } from "@qticaret/ui"
import {
  claimCart,
  claimMigration,
  confirmVerification,
  createCustomer,
  login,
  refreshToken,
  registerIdentity,
  requestPasswordReset,
  requestVerification,
  resetPassword,
} from "@/lib/account/auth"
import { accountError, safeNext } from "@/lib/account/errors"
import {
  claimsOf,
  endSession,
  forgetPending,
  pendingToken,
  rememberInvite,
  rememberPending,
  startSession,
  takeInvite,
} from "@/lib/account/session"
import { cartIdFromCookie, forgetCart } from "@/lib/cart/cookie"
import { storeCall } from "@/lib/store-api/server"
import { challengeOf } from "@/lib/checkout/pay"

const NONE = null
const failed = (error: string): ChallengeResult => ({ ok: false, error, challenge: NONE })

const Email = z.email().max(254)
// The backend's policy decides (adr/0043); this only keeps nonsense from the wire
const Password = z.string().min(1).max(256)
const Challenge = z
  .string()
  .regex(/^[\w.-]{1,300}$/)
  .optional()
  .or(z.literal("").transform(() => undefined))

/** A 428's challenge for the form, or the refusal in words' key. */
function answered(error: unknown, fallback: string): ChallengeResult {
  const challenge = challengeOf(error)
  return challenge ? { ok: false, error: NONE, challenge } : failed(accountError(error, fallback))
}

/** Signed in: the session, the open cart made the customer's, the page the shopper came for. */
async function signedIn(token: string, next: string | null): Promise<never> {
  await startSession(token)
  await forgetPending()
  const cartId = await cartIdFromCookie()
  if (cartId) {
    // A cart that cannot move (ordered, another's) stays as it is
    await claimCart(cartId, token).catch(() => undefined)
  }
  // An invited customer's old shop's orders, reviews and addresses (F14 G6)
  const invite = await takeInvite()
  if (invite) {
    await claimMigration(invite, token).catch(() => undefined)
  }
  revalidatePath("/", "layout")
  redirect(safeNext(next) ?? "/hesap")
}

const Login = z.object({
  email: Email,
  password: Password,
  challenge: Challenge,
  next: z.string().max(300).optional(),
})

export async function loginAction(
  _state: ChallengeResult,
  form: FormData
): Promise<ChallengeResult> {
  const parsed = Login.safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    return failed("account.login_failed")
  }
  const { email, password, challenge, next } = parsed.data
  let answer: Awaited<ReturnType<typeof login>>
  try {
    answer = await login(email, password, challenge ?? null)
    if (answer.kind === "verify") {
      await requestVerification(answer.token, email)
      await rememberPending(answer.token)
    }
  } catch (error) {
    return answered(error, "account.login_failed")
  }
  if (answer.kind === "verify") {
    redirect("/hesap/dogrula?gonderildi=1")
  }
  return signedIn(answer.token, next ?? null)
}

const Register = z.object({
  first_name: z.string().trim().min(1).max(60),
  last_name: z.string().trim().min(1).max(60),
  email: Email,
  phone: z
    .string()
    .transform((value) => value.replace(/[\s()-]/g, ""))
    .pipe(z.string().regex(/^$|^(?:\+90|0090|90|0)?5\d{9}$/)),
  password: Password,
  accept: z.literal("on").optional(),
  terms: z.literal("1").optional(),
  davet: z.string().max(200).optional(),
  challenge: Challenge,
})

/**
 * A new account: the login, the customer behind it, then the verification
 * mail; the browser keeps the login's key a quarter of an hour so the link
 * (or the code) confirms without the password again.
 */
export async function registerAction(
  _state: ChallengeResult,
  form: FormData
): Promise<ChallengeResult> {
  const parsed = Register.safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "")
    return failed(
      field === "phone"
        ? "checkout.phone_invalid"
        : field === "email"
          ? "checkout.email_invalid"
          : field === "first_name" || field === "last_name"
            ? "checkout.name_required"
            : "account.register_failed"
    )
  }
  const input = parsed.data
  if (input.terms === "1" && input.accept !== "on") {
    return failed("account.terms_required")
  }
  try {
    const token = await registerIdentity(input.email, input.password, input.challenge ?? null)
    await createCustomer(token, {
      first_name: input.first_name,
      last_name: input.last_name,
      ...(input.phone ? { phone: input.phone } : {}),
    })
    await requestVerification(token, input.email)
    await rememberPending(token)
    if (input.davet) {
      await rememberInvite(input.davet)
    }
  } catch (error) {
    return answered(error, "account.register_failed")
  }
  // `yeni`: the account was just made (the sign-up event, docs/20)
  redirect("/hesap/dogrula?gonderildi=1&yeni=1")
}

const Verify = z.object({
  code: z.string().regex(/^[\w-]{10,128}$/),
  email: Email.optional().or(z.literal("").transform(() => undefined)),
  password: Password.optional().or(z.literal("").transform(() => undefined)),
  challenge: Challenge,
})

/**
 * The e-mail confirmed with its code, by the login that asked for it: the
 * key this browser kept, or a fresh sign-in when it has none. Then the
 * key, refreshed, names the account and the session starts.
 */
export async function verifyAction(
  _state: ChallengeResult,
  form: FormData
): Promise<ChallengeResult> {
  const parsed = Verify.safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    return failed("account.code_invalid")
  }
  const { code, email, password, challenge } = parsed.data
  let token = await pendingToken()
  let fresh: string
  try {
    if (!token) {
      if (!email || !password) {
        return failed("account.login_failed")
      }
      const answer = await login(email, password, challenge ?? null)
      // Verified already (a second click on the link): nothing to confirm
      token = answer.token
      if (answer.kind === "verify") {
        await confirmVerification(token, code)
      }
    } else {
      await confirmVerification(token, code)
    }
    fresh = await refreshToken(token)
  } catch (error) {
    return answered(error, "account.code_invalid")
  }
  if (!claimsOf(fresh).actor_id) {
    await forgetPending()
    redirect("/hesap/giris?dogrulandi=1")
  }
  return signedIn(fresh, "/hesap?hosgeldin=1")
}

export async function forgotAction(
  _state: ChallengeResult,
  form: FormData
): Promise<ChallengeResult> {
  const parsed = Email.safeParse(form.get("email"))
  if (!parsed.success) {
    return failed("checkout.email_invalid")
  }
  try {
    await requestPasswordReset(parsed.data)
  } catch (error) {
    // Whether the address has an account is not told (the answer is the same)
    const result = answered(error, "account.reset_failed")
    if (result.challenge || result.error === "errors.too_many_requests") {
      return result
    }
  }
  redirect("/hesap/sifre-sifirla?gonderildi=1")
}

const Reset = z.object({
  token: z
    .string()
    .regex(/^[\w-]+\.[\w-]+\.[\w-]+$/)
    .max(4096),
  password: Password,
})

export async function resetAction(
  _state: ChallengeResult,
  form: FormData
): Promise<ChallengeResult> {
  const parsed = Reset.safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    return failed("account.reset_link_invalid")
  }
  try {
    await resetPassword(parsed.data.token, parsed.data.password)
  } catch (error) {
    return answered(error, "account.reset_link_invalid")
  }
  await endSession()
  redirect("/hesap/giris?sifre=1")
}

/** Signs out: the session goes, and the cart with it (it is the customer's now). */
export async function logoutAction(): Promise<void> {
  await endSession()
  await forgetPending()
  await forgetCart()
  revalidatePath("/", "layout")
  redirect("/")
}

const Lookup = z.object({
  display_id: z
    .string()
    .transform((value) => value.replace(/^#/, "").trim())
    .pipe(z.string().regex(/^\d{1,10}$/)),
  email: Email,
  challenge: Challenge,
})

/**
 * "Find my order" (adr/0037 §2): the order's number and its e-mail; the
 * backend mails the order's link when they match and answers the same
 * either way, so nothing is told here.
 */
export async function lookupAction(
  _state: ChallengeResult,
  form: FormData
): Promise<ChallengeResult> {
  const parsed = Lookup.safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    return failed("account.lookup_failed")
  }
  const { display_id, email, challenge } = parsed.data
  try {
    await storeCall("/store/order-lookup", {
      method: "POST",
      body: { display_id: Number(display_id), email },
      ...(challenge ? { headers: { "x-challenge": challenge } } : {}),
    })
  } catch (error) {
    return answered(error, "account.lookup_failed")
  }
  redirect("/siparis?gonderildi=1")
}
