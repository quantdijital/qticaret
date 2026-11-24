import { requireTurnstile, turnstileOver } from "./turnstile"

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

/**
 * Cloudflare Turnstile at the risky gates (adr/0044 Ek 2026-11-24), in one
 * list mounted right after the area-wide rate limits (middlewares.ts): a
 * bot is turned away before anything does work for it (the block list,
 * the body's checks, the password policy). Each middleware passes all but
 * POST.
 *
 * Without `methods` where the route has no paths below it: Medusa sorts a
 * method-scoped middleware after unscoped ones (the password policy on
 * `/auth/:actor_type/emailpass/register` ran first, the 2026-11-24 HTTP
 * run). With `methods` where an unscoped matcher would take the paths
 * below too: a sign-in's (registration, reset), a review's (its photos)
 * and a stock alert's (its confirmation).
 */
export const TURNSTILE_ROUTES = [
  // Every request
  { matcher: "/auth/customer/emailpass/register", middlewares: [requireTurnstile("register")] },
  {
    matcher: "/auth/customer/emailpass/reset-password",
    middlewares: [requireTurnstile("password_reset")],
  },
  { matcher: "/auth/user/emailpass/register", middlewares: [requireTurnstile("staff_register")] },
  {
    matcher: "/auth/user/emailpass/reset-password",
    middlewares: [requireTurnstile("staff_password_reset")],
  },
  { matcher: "/auth/verification/request", middlewares: [requireTurnstile("verification")] },
  { matcher: "/store/carts/:id/payment-session", middlewares: [requireTurnstile("checkout")] },
  {
    matcher: "/auth/customer/emailpass",
    methods: ["POST" as const],
    middlewares: [requireTurnstile("login")],
  },
  {
    matcher: "/auth/user/emailpass",
    methods: ["POST" as const],
    middlewares: [requireTurnstile("staff_login")],
  },
  // Past a soft limit per address (the proof of work's counters, adr/0044 §1)
  {
    matcher: "/store/order-lookup",
    middlewares: [turnstileOver("order_lookup", { max: 5, windowMs: HOUR })],
  },
  {
    // Its confirmation (`/confirm`) is the e-mail's link, never counted
    matcher: "/store/stock-alerts",
    methods: ["POST" as const],
    middlewares: [turnstileOver("stock_alert", { max: 5, windowMs: HOUR })],
  },
  // The contact form and a dated product's call-me request share one counter
  ...["/store/contact-messages", "/store/booking-requests"].map((matcher) => ({
    matcher,
    middlewares: [turnstileOver("contact", { max: 1, windowMs: HOUR })],
  })),
  {
    matcher: "/store/newsletter",
    middlewares: [turnstileOver("newsletter", { max: 3, windowMs: HOUR })],
  },
  {
    matcher: "/store/gift-cards/balance",
    middlewares: [turnstileOver("gift_card", { max: 3, windowMs: 15 * MINUTE })],
  },
  {
    matcher: "/store/products/:id/reviews",
    methods: ["POST" as const],
    middlewares: [turnstileOver("review", { max: 3, windowMs: HOUR })],
  },
  ...["/store/products/:id/questions", "/store/product-questions/:id/answers"].map((matcher) => ({
    matcher,
    middlewares: [turnstileOver("question", { max: 3, windowMs: HOUR })],
  })),
]
