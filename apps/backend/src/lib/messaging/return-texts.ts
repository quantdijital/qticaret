/**
 * What a return or exchange request's messages say (F9.4, adr/0032), by
 * key: part of the message catalog (`texts.ts`). A key ending in
 * `.return` or `.exchange` is read by the request's kind.
 */
export const RETURN_TEXTS: Readonly<Record<string, string>> = {
  "returns.lines": "Talepteki ürünler",
  // `{talep_türü}` in a shop's own text (adr/0036 Ek 2026-11-10)
  "returns.kind.return": "iade",
  "returns.kind.exchange": "değişim",
  "return_requested.subject.return": "İade talebiniz alındı (#{{number}})",
  "return_requested.subject.exchange": "Değişim talebiniz alındı (#{{number}})",
  "return_requested.preheader": "{{shop}} talebinizi inceleyecek.",
  "return_requested.heading.return": "{{name}}, iade talebinizi aldık",
  "return_requested.heading.exchange": "{{name}}, değişim talebinizi aldık",
  "return_requested.intro.return":
    "#{{number}} numaralı siparişiniz için iade talebinizi aldık. İnceleyip size haber vereceğiz.",
  "return_requested.intro.exchange":
    "#{{number}} numaralı siparişiniz için değişim talebinizi aldık. İnceleyip size haber vereceğiz.",
  "return_approved.subject.return": "İade talebiniz onaylandı (#{{number}})",
  "return_approved.subject.exchange": "Değişim talebiniz onaylandı (#{{number}})",
  "return_approved.preheader": "{{shop}} talebinizi onayladı.",
  "return_approved.heading.return": "{{name}}, iadeniz onaylandı",
  "return_approved.heading.exchange": "{{name}}, değişiminiz onaylandı",
  "return_approved.intro.return":
    "#{{number}} numaralı siparişinizdeki ürünleri geri gönderebilirsiniz. Ürünler bize ulaşıp kontrol edildikten sonra ödemeniz iade edilir.",
  "return_approved.intro.exchange":
    "#{{number}} numaralı siparişinizdeki ürünleri geri gönderebilirsiniz. Ürünler bize ulaştığında yenileri yola çıkar.",
  "return_approved.code_title": "İade kargosu",
  // adr/0031 Ek 2026-11-26: the shop's one contracted return code, said at any branch
  "return_approved.contracted":
    "İade paketinizi {{carrier}} şubesine verin ve gönderirken '{{code}}' anlaşmalı iade kodunu söyleyin. Kargo ücreti ödemezsiniz.",
  "return_approved.code": "Koliyi kargo şubesine teslim ederken bu kodu söyleyin: {{code}}",
  "return_approved.no_code":
    "Ürünleri nasıl göndereceğinizle ilgili mağaza sizinle iletişime geçecek.",
  "return_refunded.subject.return": "İadeniz yapıldı (#{{number}})",
  "return_refunded.subject.exchange": "Değişim farkınız iade edildi (#{{number}})",
  "return_refunded.preheader": "{{shop}} ödemenizi iade etti.",
  "return_refunded.heading.return": "{{name}}, iadeniz yapıldı",
  "return_refunded.heading.exchange": "{{name}}, farkınız iade edildi",
  "return_refunded.intro.return":
    "#{{number}} numaralı siparişinizden iade ettiğiniz ürünlerin ödemesini geri gönderdik.",
  "return_refunded.intro.exchange":
    "#{{number}} numaralı siparişinizdeki değişimin farkını geri gönderdik.",
  "return_refunded.amount": "İade tutarı",
  "return_refunded.when": "Tutarın kartınıza yansıması bankanıza göre birkaç iş günü sürebilir.",
  "return_refunded.refused_note":
    "Kabul edilmeyen ürünler (koruyucu ambalajı açılmış) bu tutara dahil değildir.",
  // adr/0032 Ek 2026-11-03: units refused at receipt, a sealed good opened (MSY md. 15/1-ç)
  "return_refused.subject.return": "İadenizde kabul edilmeyen ürünler var (#{{number}})",
  "return_refused.subject.exchange": "Değişiminizde kabul edilmeyen ürünler var (#{{number}})",
  "return_refused.preheader": "{{shop}} gönderdiğiniz ürünleri kontrol etti.",
  "return_refused.heading.return": "{{name}}, iade ettiğiniz ürünleri kontrol ettik",
  "return_refused.heading.exchange": "{{name}}, değişim için gönderdiğiniz ürünleri kontrol ettik",
  "return_refused.intro.return":
    "#{{number}} numaralı siparişinizden iade ettiğiniz ürünler bize ulaştı. Aşağıdaki ürünleri kabul edemedik; bu ürünlerin bedeli iade edilmez.",
  "return_refused.intro.exchange":
    "#{{number}} numaralı siparişinizden değişim için gönderdiğiniz ürünler bize ulaştı. Aşağıdaki ürünleri kabul edemedik; bu ürünler değiştirilmez.",
  "return_refused.lines": "Kabul edilmeyen ürünler",
  "return_refused.reason.unsealed":
    "Neden: koruyucu ambalajı açılmış; sağlık ve hijyen açısından iadesi uygun değil",
  "return_refused.goods":
    "Bu ürünler sizindir. Ücreti mağazaya ait olmak üzere adresinize geri gönderilebilir ya da mağazadan teslim alabilirsiniz. Hangisini istediğinizi bize bildirin.",
  "return_refused.rest.return": "Kabul ettiğimiz diğer ürünlerin ödemesi ayrıca iade edilecek.",
  "return_refused.rest.exchange": "Kabul ettiğimiz diğer ürünler için değişim sürüyor.",
  // An approval taken back before anything came back (order #691)
  "return_canceled.subject.return": "İade talebiniz iptal edildi (#{{number}})",
  "return_canceled.subject.exchange": "Değişim talebiniz iptal edildi (#{{number}})",
  "return_canceled.preheader": "{{shop}} talebinizi iptal etti; ürün göndermenize gerek yok.",
  "return_canceled.heading.return": "{{name}}, iade talebiniz iptal edildi",
  "return_canceled.heading.exchange": "{{name}}, değişim talebiniz iptal edildi",
  "return_canceled.intro.return":
    "#{{number}} numaralı siparişinizdeki iade talebiniz iptal edildi. Ürünleri geri göndermenize gerek yok; size verilen kargo kodu artık geçerli değil.",
  "return_canceled.intro.exchange":
    "#{{number}} numaralı siparişinizdeki değişim talebiniz iptal edildi. Ürünleri geri göndermenize gerek yok; size verilen kargo kodu artık geçerli değil.",
  "return_canceled.again":
    "Ürünleri yine de iade etmek ya da değiştirmek isterseniz süre içinde sipariş sayfanızdan yeni talep oluşturabilirsiniz. Bu iptal size bir hata gibi geldiyse bizimle iletişime geçin.",
}
