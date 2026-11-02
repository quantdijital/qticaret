/**
 * The phone's bottom bar asks the menu drawer to open (docs/20 "mobil alt
 * gezinme"). The drawer cancels the event when it heard it; when nothing
 * did (no script yet), the bar's link goes to `/kategoriler` instead.
 */
export const OPEN_MENU_EVENT = "qt:open-menu"
