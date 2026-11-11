/**
 * The owner's invitation link as a shop printed it (Ek C10), checked
 * before the control plane mails it under its own name: the shop's panel
 * page `/invite` with a token after `#`, nothing else. A shop's command
 * output is not trusted to choose what our e-mail links to. On a
 * developer's machine the panel is on this machine; deployed, https.
 */

const TOKEN = /^#token=[A-Za-z0-9._~%-]{16,2048}$/
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

export function ownerInviteLinkProblem(link: string, local: boolean): string | null {
  if (link.length > 4096) {
    return "provisioning.invite_link_invalid"
  }
  let url: URL
  try {
    url = new URL(link)
  } catch {
    return "provisioning.invite_link_invalid"
  }
  const hereOnly = LOCAL_HOSTS.has(url.hostname) || url.hostname.endsWith(".localhost")
  const valid =
    (url.protocol === "https:" || (local && url.protocol === "http:")) &&
    url.username === "" &&
    url.password === "" &&
    url.search === "" &&
    url.pathname === "/invite" &&
    TOKEN.test(url.hash) &&
    (!local || hereOnly)
  return valid ? null : "provisioning.invite_link_invalid"
}
