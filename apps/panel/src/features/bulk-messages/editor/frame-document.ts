/** The screens an e-mail is looked at on: a reading pane and a phone. */
export const DEVICES = {
  desktop: { width: 720, height: 900 },
  phone: { width: 375, height: 667 },
} as const

export type PreviewDevice = keyof typeof DEVICES

// Nothing in the e-mail opens: a click reaches no link, and one that still
// fires (the keyboard) asks for a new window the sandbox refuses
const LOCK =
  '<base target="_blank"><style>a,a *{pointer-events:none!important;cursor:default!important}</style>'

/** The e-mail's HTML with its links locked, placed in its head so its doctype still counts. */
export function frameDocument(html: string): string {
  const head = /<head\b[^>]*>/i.exec(html)
  if (!head) {
    return `${LOCK}${html}`
  }
  const at = head.index + head[0].length
  return `${html.slice(0, at)}${LOCK}${html.slice(at)}`
}
