/**
 * The footer's "cookie preferences" link asks the banner to open again
 * (D9). The banner cancels the event when it heard it; when nothing did,
 * the link goes to `/cerez-tercihleri` as it would without script.
 */
export const COOKIE_PREFERENCES_EVENT = "qt:cookie-preferences"
