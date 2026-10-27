// The payment test page's result step (adr/0028): with checkout.js, one script.
/* global $, el, money, config, state, CART_KEY, renderCart */
/* exported showBankTransfer, followReturn */

/** A bank transfer's order, placed awaiting the money, and where to send it. */
function showBankTransfer(order, bank) {
  $("result").hidden = false
  $("result-body").replaceChildren(
    `Sipariş #${order.display_id} açıldı, ödeme bekleniyor. `,
    `${bank.bank_name} · ${bank.account_holder} · ${bank.iban} hesabına ${money(bank.amount / 100)} gönderin; `,
    `açıklamaya sipariş numarasını yazın (${bank.deadline_hours} saat içinde). `,
    el("a", {
      href: `${config.panelUrl}/orders/${order.id}`,
      target: "_blank",
      textContent: "Panelde aç",
    })
  )
}

async function followReturn(params) {
  const id = params.get("sepet")
  const failed = params.get("sonuc") === "hata"
  $("result").hidden = false
  const say = (...nodes) => $("result-body").replaceChildren(...nodes)
  if (failed) return say("Ödeme reddedildi. Sepet açık; yeniden ödeyebilirsiniz.")
  // iyzico's callback says what became of a payment that is not an order yet
  const status = params.get("payment_status")
  if (status === "refund") return say("Ödeme alındı ama siparişe dönüşemedi; tutar iade edilecek.")
  for (let attempt = 0; attempt < 120; attempt++) {
    const { cart } = await fetch(`/dev/checkout/order?cart_id=${encodeURIComponent(id)}`, {
      credentials: "omit",
    }).then((r) => r.json())
    if (cart?.order) {
      localStorage.removeItem(CART_KEY)
      state.cart = null
      renderCart()
      $("result").classList.add("ok")
      return say(
        `Sipariş #${cart.order.display_id} açıldı, ödeme alındı (${cart.payment_status}). `,
        el("a", {
          href: `${config.panelUrl}/orders/${cart.order.id}`,
          target: "_blank",
          textContent: "Panelde aç",
        })
      )
    }
    say(
      status === "review"
        ? "Ödeme iyzico'nun sahtekârlık incelemesinde; onaylanınca uzlaştırma işi (10 dakikada bir) siparişi açacak."
        : attempt < 10
          ? "Ödeme bildirimi bekleniyor…"
          : "Bildirim gelmedi. Uzlaştırma işi (10 dakikada bir) sağlayıcıya sorup siparişi açacak; sayfa beklemeye devam ediyor."
    )
    await new Promise((resolve) => setTimeout(resolve, attempt < 10 ? 2000 : 10000))
  }
}
