/**
 * The Atölye theme's error page (adr/0046 Ek 2026-11-05): a client
 * component, its own entry so `app/error.tsx` and `app/global-error.tsx`
 * load it without the theme's pages (`next.config.ts` aliases
 * `@qticaret/storefront-theme-error` here).
 */
export { ErrorPage } from "@qticaret/theme-atolye/error"
