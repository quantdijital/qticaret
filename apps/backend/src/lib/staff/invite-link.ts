import { panelUrl } from "../env"

/** The panel's page that turns an invitation into an account (F12.6): the token in its query. */
export const inviteLink = (token: string, base: string = panelUrl()): string =>
  `${base}/invite?${new URLSearchParams({ token }).toString()}`
