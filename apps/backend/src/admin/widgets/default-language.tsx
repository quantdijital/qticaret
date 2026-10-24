import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

// Mirrors DEFAULT_LOCALE in packages/types; the admin bundle cannot import it.
const DEFAULT_ADMIN_LANGUAGE = "tr"
const APPLIED_KEY = "qticaret.admin-default-language-applied"

/**
 * Medusa has no setting for the admin's default language; it follows the
 * browser. On the first visit to the login page this switches the admin to
 * Turkish once (F1.7). A language picked later in Profile is kept, because
 * the stored marker stops this from running again.
 */
function DefaultLanguage() {
  const { i18n } = useTranslation()

  useEffect(() => {
    if (claimFirstVisit() && i18n.language !== DEFAULT_ADMIN_LANGUAGE) {
      void i18n.changeLanguage(DEFAULT_ADMIN_LANGUAGE)
    }
  }, [i18n])

  return null
}

/**
 * True once per browser. When storage is unavailable (private mode, blocked
 * site data) it returns false, so the browser language stays in effect
 * instead of overriding the user's choice on every visit.
 */
function claimFirstVisit(): boolean {
  try {
    if (window.localStorage.getItem(APPLIED_KEY) !== null) {
      return false
    }
    window.localStorage.setItem(APPLIED_KEY, new Date().toISOString())
    return true
  } catch {
    return false
  }
}

export const config = defineWidgetConfig({
  zone: "login.before",
})

export default DefaultLanguage
