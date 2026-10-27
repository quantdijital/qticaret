# ADR-0028: Geliştirme ortamında ödeme deneme sayfası

- **Durum:** Kabul edildi (2026-10-27, kullanıcı onayı: "tamamdır başlayabilirsin"). CLAUDE.md'deki "şimdi storefront kodu yazma" kuralına sınırlı bir istisna.
- **Tarih:** 2026-10-27

## Bağlam

Storefront ve temalar sonraki aşamada (CLAUDE.md). F5'in müşteri tarafı bu yüzden yalnızca Store API'dir; HTTP testleri vitrin gibi davranır, sahte PayTR ve iyzico sunucuları sağlayıcının yerini alır.

Kullanıcı 2026-10-27'de müşteri tarafını hiç göremediğini söyledi. Ödemenin, müşterinin göreceği gibi elle denenebilmesi gerekiyor: sepet, sağlayıcının ödeme sayfası, sonuç ve paneldeki sipariş.

İki kısıt var:

- **PayTR'nin bildirim adresi hesap başına tek.** İlk müşterinin firması PayTR'yi canlıda kullanıyor; test modu aynı hesapla çalışır. Bu hesapla yapılan deneme ödemesinin bildirimi firmanın kendi sistemine gider. Gerçek PayTR denemesi bu yüzden yalnızca planlı test penceresinde yapılır (F5 V11, PROGRESS "Açık sorular").
- **PayTR sonucu sunucudan sunucuya bildirir.** Geliştiricinin `localhost`'una ulaşamaz; gerçek PayTR'yle yerelde deneme bir tünel adresi ister.

## Karar

1. **Yalnızca geliştirmede açılan bir sayfa.** Backend `GET /dev/checkout`'u yalnızca `NODE_ENV=development` iken sunar. Başka her ortamda (test, staging, canlı) uç 404 döner; bu testle kanıtlanır.
2. **Vitrin değil, deneme aracı.**
   - Tek bir statik HTML ve framework'süz JavaScript; derleme yok, tema yok, SEO yok, müşteri hesabı yok.
   - Metinler sayfada Türkçe yazılır, i18n anahtarı kullanılmaz (ürün arayüzü değil, geliştirici aracı).
   - Yalnızca herkese açık Store API'yi çağırır; vitrin hangi uçları çağıracaksa onları. Sayfa bu yüzden Store API'nin elle yapılan bir sözleşme denemesidir.
   - Demo bölgesinin publishable anahtarını sunucu, sayfayı verirken ekler (yalnızca geliştirmede).
3. **Akış:** demo ürünler → sepet → adres ve e-posta (hazır sahte bilgiler) → kargo yöntemi → sağlayıcı seçimi → "Öde" → `POST /store/carts/:id/payment-session` (ADR-0026) → sağlayıcının ödeme sayfası → dönüş sayfası: sepetin ve siparişin durumu, panelde siparişin bağlantısı.
4. **Sağlayıcılar:**
   - **PayTR:** sahte PayTR (`PAYTR_BASE_URL`) kendi "ödeme sayfasını" sunar: başarılı ödeme, reddedilen kart ve bildirimsiz kapanma düğmeleri. Seçilen sonuç bildirimi gerçek imzayla backend'e gönderir. Gerçek PayTR test modu yalnızca test penceresinde, tünelle.
   - **iyzico:** gerçek sandbox. Sonuç tarayıcı üzerinden döner (callback); yerel adresin kabul edildiği V9'da sandbox'ta doğrulanır.
5. **Ömrü:** storefront aşaması başlayınca sayfa ve ucu silinir; docs/03'te not.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Geliştirmede backend'in sunduğu tek sayfa (seçilen)** | Az kod, yeni uygulama yok; Store API'yi vitrin gibi kullanır; canlıya hiç çıkmaz | Görsel olarak ham; vitrinin yerini tutmaz |
| Medusa'nın Next.js storefront starter'ı | Hazır vitrin | Ödeme akışımız kendi ucumuz (ADR-0026); starter'ın checkout'u değiştirilmeden çalışmaz; storefront kararlarını erkene çeker |
| Ayrı bir Vite uygulaması | Panel diliyle aynı | Yeni uygulama, derleme ve dağıtım; vitrine kayar |
| Yalnızca otomatik testler | Ek kod yok | Kullanıcı müşteri tarafını göremez |

## Sonuçlar

- Her F5 adımı (V2'den başlayarak) bu sayfadan elle de denenebilir; e2e'ye girmez, otomatik doğrulama HTTP testlerinde kalır.
- `packages/testing`'in sahte PayTR'si bir ödeme sayfası kazanır; testler de aynı sayfayı kullanabilir.
- CLAUDE.md'nin "Şu anki odak" maddesi bu istisnayı anar.
