/**
 * Google's consent screen in a browser, for a developer's machine
 * (`pnpm dev:google`): the account, what the platform asks for (each
 * scope beyond sign-in a box the shop may clear, as Google's granular
 * consent lets it), "İptal" and "Devam". The form posts back here; the
 * answer is the same address `consent` gives a test.
 */

const SIGN_IN = new Set(["openid", "email", "profile"])

/** What Google's screen says each scope allows, in Turkish. */
const SCOPE_WORDS: Record<string, string> = {
  "https://www.googleapis.com/auth/content":
    "Ürün listelerinizi ve hesaplarınızı Google Alışveriş için yönetme",
  "https://www.googleapis.com/auth/webmasters":
    "Doğrulanmış siteleriniz için Search Console verilerini görüntüleme ve yönetme",
}

const escape = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char
  )

/** The consent screen for an authorization request (its query string as Google received it). */
export function consentPage(query: string, email: string, appName = "Quant Ticaret"): string {
  const asked = (new URLSearchParams(query).get("scope") ?? "").split(" ").filter(Boolean)
  const choices = asked
    .filter((scope) => !SIGN_IN.has(scope))
    .map(
      (scope, index) =>
        `<label class="row"><input type="checkbox" name="scope" value="${escape(scope)}" checked id="s${String(index)}"><span>${escape(SCOPE_WORDS[scope] ?? scope)}</span></label>`
    )
    .join("")
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Google ile oturum açın</title>
<style>
body{margin:0;font-family:Roboto,Arial,sans-serif;background:#f0f4f9;color:#1f1f1f}
main{max-width:720px;margin:48px auto;background:#fff;border-radius:28px;padding:36px 40px}
h1{font-size:28px;font-weight:400;margin:16px 0 8px}
.account{display:inline-block;border:1px solid #747775;border-radius:16px;padding:4px 12px;font-size:14px;margin-bottom:24px}
.row{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid #e3e3e3;font-size:14px}
.fixed{color:#444746;font-size:14px;padding:12px 0;border-bottom:1px solid #e3e3e3}
.trust{font-size:14px;color:#444746;margin-top:24px;line-height:1.5}
.actions{display:flex;justify-content:flex-end;gap:12px;margin-top:32px}
button{font:inherit;font-size:14px;border-radius:20px;padding:10px 24px;cursor:pointer}
.cancel{background:none;border:none;color:#0b57d0}
.go{background:#0b57d0;color:#fff;border:none}
</style></head>
<body><main>
<svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2.1 5.1-4.4 6.7v5.6h7.1c4.2-3.8 6.6-9.5 6.6-16.3z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.6c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.4v5.7C8 40.9 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.7 28.1c-.4-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.4C2.9 17.2 2 20.5 2 24s.9 6.8 2.4 9.8l7.3-5.7z"/><path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.4 2 8 7.1 4.4 14.2l7.3 5.7c1.7-5.2 6.6-9.1 12.3-9.1z"/></svg>
<h1>${escape(appName)}, Google Hesabınıza erişmek istiyor</h1>
<div class="account">${escape(email)}</div>
<p>Bu işlem, ${escape(appName)} uygulamasının şunları yapmasına izin verir:</p>
<form method="post" action="/o/oauth2/v2/approve">
<input type="hidden" name="request" value="${escape(query)}">
${choices}
<div class="fixed">Google Hesabınızın birincil e-posta adresini görme</div>
<p class="trust">${escape(appName)} uygulamasına güvendiğinizden emin olun. Verdiğiniz erişimi Google Hesabınızdan istediğiniz zaman kaldırabilirsiniz.</p>
<div class="actions"><button class="cancel" name="decision" value="deny">İptal</button><button class="go" name="decision" value="allow">Devam</button></div>
</form>
</main></body></html>`
}

/**
 * The form's answer: the scopes the shop left ticked (sign-in ones always),
 * as `consent` takes them; `deny` when it pressed "İptal".
 */
export function approvalOf(body: string): {
  query: string
  answer: "allow" | "deny"
  scopes: string[]
} {
  const form = new URLSearchParams(body)
  const query = form.get("request") ?? ""
  const asked = (new URLSearchParams(query).get("scope") ?? "").split(" ").filter(Boolean)
  const ticked = new Set(form.getAll("scope"))
  return {
    query,
    answer: form.get("decision") === "allow" ? "allow" : "deny",
    scopes: asked.filter((scope) => SIGN_IN.has(scope) || ticked.has(scope)),
  }
}
