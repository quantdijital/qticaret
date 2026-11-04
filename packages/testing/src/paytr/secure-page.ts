import { FAMILY_NAMES, secureSchemeOf, spacedPan } from "./cards"
import type { FakePayment, SecureStep } from "./handlers"
import { escape, lira, lockIcon, maskedPhone, page, paytrPage, turkishTime } from "./page-parts"

/**
 * The card bank's 3-D Secure page, which PayTR's form opens before it
 * charges: the merchant, the amount, the card, a six-digit code sent by
 * SMS. Any six digits pass; the card's number decides the bank's answer.
 * "Onayla" sends the shopper's whole window back to the shop, as PayTR does.
 */

const SECURE_STYLE = `
  .acs header{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:2px solid #111827;margin-bottom:14px}
  .acs .scheme{font-weight:700;font-size:15px;color:#111827}
  .acs .bank{font-size:12px;font-weight:700;padding:3px 8px;border-radius:4px;background:#111827;color:#fff}
  .acs h1{font-size:17px;margin:0 0 10px}
  .acs dl{display:grid;grid-template-columns:120px 1fr;gap:6px 10px;margin:0 0 14px;font-size:13px}
  .acs dt{color:#6b7280}.acs dd{margin:0;font-weight:600}
  .acs .code{max-width:220px;letter-spacing:.3em;font-size:18px;text-align:center}
  .acs .timer{font-size:12px;color:#6b7280;margin:6px 0 14px}
  .acs button{background:#111827}.acs button:hover{background:#000}
  .acs .cancel{display:block;text-align:center;margin-top:10px;font-size:13px;color:#374151}
`

const SCRIPT = `
(function () {
  var left = 180, out = document.getElementById("left");
  var tick = setInterval(function () {
    left -= 1;
    if (left <= 0) { clearInterval(tick); out.textContent = "süre doldu"; return; }
    out.textContent = String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0");
  }, 1000);
})();
`

export interface SecurePageView {
  payment: FakePayment
  step: SecureStep
  /** Where the code posts; the card form's address for "İptal". */
  action: string
  cancel: string
  now: number
  error?: string
}

export function securePage(view: SecurePageView): string {
  const { payment, step } = view
  const card = step.card
  const amount =
    step.installments > 1
      ? `${lira(step.totalAmount)} (${String(step.installments)} taksit)`
      : lira(step.totalAmount)
  const body = `<style>${SECURE_STYLE}</style><main class="acs">
  <header><span class="scheme">${escape(secureSchemeOf(card.bin))}</span>${card.family ? `<span class="bank">${FAMILY_NAMES[card.family]}</span>` : ""}</header>
  <h1>Ödeme doğrulama</h1>
  <dl><dt>İşyeri</dt><dd>PAYTR ODEME</dd><dt>Tutar</dt><dd>${escape(amount)}</dd><dt>Tarih</dt><dd>${turkishTime(view.now)}</dd><dt>Kart numarası</dt><dd>${spacedPan(card)}</dd></dl>
  <p>${escape(maskedPhone(payment.phone ?? ""))} numaralı telefonunuza gönderilen 6 haneli doğrulama şifresini girin.</p>
  ${view.error ? `<p class="error" role="alert">${escape(view.error)}</p>` : ""}
  <form method="post" action="${escape(view.action)}" target="_top">
    <div class="field"><label for="sms_code">Doğrulama şifresi</label><input id="sms_code" class="code" name="sms_code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></div>
    <p class="timer">Kalan süre: <span id="left">03:00</span></p>
    <button type="submit">Onayla</button>
  </form>
  <a class="cancel" href="${escape(view.cancel)}">İptal</a>
  <footer><p class="secure" style="justify-content:center">${lockIcon()}Bu sayfa kartınızı veren bankanın güvenli doğrulama sayfasıdır.</p></footer>
</main>`
  return page("3D Secure doğrulama", body, SCRIPT)
}

/** A payment already finished: what it came to, and the way back to the shop. */
export function finishedPage(payment: FakePayment): string {
  const paid = payment.status === "success"
  const back = paid ? payment.okUrl : payment.failUrl
  return paytrPage(
    "Ödeme sonucu | PayTR",
    `<main><div class="top"><div><small>Ödeme tutarı</small><strong>${lira(payment.totalAmount)}</strong></div></div>
  <p>Bu ödeme sonuçlandı: <strong>${paid ? "ödemeniz alındı" : "ödeme onaylanmadı"}</strong>.</p>
  <p><a href="${escape(back)}" target="_top">Mağazaya dön</a></p></main>`
  )
}

/** A form address that is not (or no longer) a payment's. */
export function missingPage(): string {
  return paytrPage(
    "Ödeme sayfası | PayTR",
    "<main><p>Bu ödeme sayfasının süresi dolmuş ya da sayfa bulunamadı. Mağazaya dönüp ödemeyi yeniden başlatın.</p></main>"
  )
}
