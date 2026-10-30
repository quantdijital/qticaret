import { panelUrl } from "../env"

/**
 * The panel's page that turns an invitation into an account (F12.6). The
 * token after `#`: a fragment reaches no server's access log and no other
 * site's Referer; the page takes it out of the address bar once read.
 */
export const inviteLink = (token: string, base: string = panelUrl()): string =>
  `${base}/invite#${new URLSearchParams({ token }).toString()}`
