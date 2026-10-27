# ADR-0029: Çevrim dışı ödemeler: havale/EFT ve kapıda ödeme

- **Durum:** Kabul edildi (2026-10-27, otonom çalışma: önerilen seçenek uygulandı; kullanıcı sabah gözden geçirecek, PROGRESS "Gözden geçir").
- **Tarih:** 2026-10-27
- **İlgili:** ADR-0026 (barındırılan form akışı), docs/entegrasyonlar/alternatif-odeme.md, F6.5–F6.6

## Bağlam

F6, dış servis çağırmayan iki ödeme yöntemi getiriyor:
- **Havale/EFT:** sipariş hemen verilir, para sonra gelir.
- **Kapıda ödeme:** para kargoyla teslimde toplanır.

İkisi de Medusa payment provider'ı olarak yazılacak. Siparişin ve ödemenin durumları ise kart ödemelerinden farklı. Medusa 2.21.2'de doğrulanan davranışlar (kaynak, 2026-10-27):
- `authorizePayment`'in döndürdüğü `pending_authorization` durumu Medusa'da "havale, ödeme bağlantısı, kupon" için tanımlı. Sepet siparişe dönüşür, ama ortada `Payment` yoktur. Koleksiyon `awaiting` olur, siparişin `payment_status`'u da `awaiting`. Oturum daha sonra yeniden yetkilendirilebilir. `processPaymentWorkflow` bunu sipariş varken yapar.
- `authorized` dönerse `Payment` yakalanmadan (capture'sız) oluşur ve `payment_status` `authorized` olur. Yakalama `capturePaymentWorkflow` ile yapılır (`POST /admin/payments/:id/capture`).
- `cancelOrderWorkflow` gönderisi olmayan siparişi kullanıcı gerektirmeden iptal eder. Rezervasyonları bırakır, yakalanmamış ödemeyi `cancelPayment` ile iptal eder, koleksiyonları `canceled` yapar.
- `createOrderFulfillmentWorkflow` ödeme durumuna bakmaz: ödenmemiş sipariş de kargoya verilebilir.
- `addToCartWorkflow` varyantsız, sunucunun fiyatını verdiği (`is_custom_price`) bir kalem ekleyebilir. Store ucu varyantsız kalem eklemeye izin vermez, ama kalemi değiştirmeye ve silmeye izin verir.
- `GET /store/payment-providers` bölgenin bütün sağlayıcılarını listeler. Asıl zorlama bölge bağıdır: oturum yalnızca bölgedeki bir sağlayıcıyla açılır.

## Karar

1. **İki sağlayıcı, iki farklı durum:**
   - **Havale/EFT (`pp_bank-transfer_bank-transfer`):** yetkilendirme `pending_authorization` döner. Sipariş "ödeme bekleniyor" (`awaiting`) olarak oluşur, stok rezerve edilir.
   - **Kapıda ödeme (`pp_cod_cod`):** yetkilendirme `authorized` döner. Sipariş "ödemesi teslimde alınacak" olarak oluşur. Para toplandığında yakalanır (capture): panelden elle, F7'de kargo mutabakatıyla.
2. **Havale onayı:**
   - Mağaza panelden "Havale geldi" der.
   - Onay, oturumun verisine onaylayan ve zamanı yazar.
   - Ardından oturumu Medusa'nın ödeme işleme akışıyla yeniden yetkilendirir. Sağlayıcı onaylı oturuma `captured` döner, ödeme ve sipariş işlemi oluşur.
   - Aynı sipariş iki kez onaylanamaz. İptal edilmiş sipariş onaylanamaz.
3. **Süre:**
   - Havale siparişinin ödeme süresi (saat) ayarlardadır.
   - Süresi dolan ve hâlâ `awaiting` olan sipariş bir işle `cancelOrderWorkflow` üzerinden iptal edilir; stok geri döner.
   - Müşteri bildirimi F9'da; o zamana kadar olay yayınlanır ve denetim kaydı düşer.
4. **Kargo kuralı:**
   - Ödemesi beklenen (`awaiting`, onaylanmamış havale) sipariş kargoya verilemez.
   - Test modunda ödenmiş siparişin engeli de aynı kurala katıldı (`lib/payments/shippable.ts`).
   - Kendi kargo akışımız (`planShipmentStep`) ve Medusa'nın kendi fulfillment uçları bu kuralı uygular.
   - Kapıda ödeme (`authorized`) ve sistem sağlayıcısıyla elle alınmış siparişler engellenmez.
   - Dashboard'un "Ödeme bekleyen" görevi `awaiting` siparişleri zaten sayar; panel bu aşamada "Kargoya ver"i göstermez.
5. **Kapıda ödeme ek ücreti:**
   - Ek ücret sunucuda hesaplanır: sabit tutar ya da oran, KDV dahil.
   - Kapıda ödeme seçilince sepete varyantsız, `is_custom_price` bir kalem olarak eklenir. Kalemin metadata'sında `qt_fee: "cash_on_delivery"` bulunur.
   - Başka bir yönteme geçilince kalem silinir.
   - Ek ücret kalemi Store ucundan değiştirilemez ve silinemez (ara katman).
   - Sepet tamamlanırken kalemin varlığı ve tutarı seçilen yöntemle yeniden hesaplanıp karşılaştırılır.
   - Kalem kargo gerektirmez (`requires_shipping: false`); gönderide nasıl görüneceği F7'de ele alınır.
6. **Kapıda ödemenin şartları:**
   - Özellik bayrağı (`cash_on_delivery`) açık olmalı.
   - Sepet tutarı ayardaki üst sınırın altında kalmalı.
   - Sepetin kargo seçeneği, ayardaki kapıda ödemeye izin veren seçenekler arasında olmalı.
   - Şart tutmazsa yöntem sunulmaz (`GET /store/payment/methods`) ve başlatılamaz (`POST /store/carts/:id/payment-session`).
7. **Tek giriş:**
   - Çevrim dışı yöntemler de `POST /store/carts/:id/payment-session` ile başlar; dönüş adresi gerekmez.
   - Medusa'nın kendi oturum ucu kapalı kalır (ADR-0026).
   - Sepeti tamamlama kuralı ("yalnızca barındırılan form oturumuyla", `requireHostedPayment`) "yalnızca kendi ucumuzdan başlatılmış bir oturumla" olarak genişler.
8. **Ayarlar (`platform-settings`):**
   - `bank_transfer`: açık/kapalı, hesap sahibi, banka adı, IBAN (TR, mod-97 doğrulamalı), ödeme süresi (saat).
   - `cash_on_delivery`: ek ücret türü ve değeri, üst tutar, izinli kargo seçenekleri.
   - IBAN gizli değildir; vitrine açıktır.
9. **Açıklama kodu:** havalenin açıklaması sipariş numarasıdır (`display_id`): kısa, benzersiz, alıcının sipariş sayfasında görünür. Panelde ödeme bekleyen havaleler sipariş numarasıyla eşleştirilir. Banka hareketlerinin otomatik eşleştirilmesi sonraki iyileştirme.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Havale `pending_authorization` (seçilen)** | Medusa'nın bu iş için tanımladığı durum; `awaiting` dashboard'da zaten "ödeme bekleyen"; iptalde iptal edilecek ödeme yok | Onay, oturumu yeniden yetkilendirmeyi gerektirir |
| Havale `authorized` + sonradan capture | Medusa'nın capture ucu hazır | `authorized` "ödendi" sayılır (dashboard, kargo); havalede para henüz yok |
| Ek ücret kargo fiyatına eklenir | Yeni kalem yok | Faturada ayrı satır olmaz; kargo değişince ücret kaybolur; mali müşavir ayrı satır istiyor (docs/entegrasyonlar/alternatif-odeme.md) |
| Ek ücret Medusa promosyonuyla (negatif indirim) | — | Promosyon motoru artı tutar desteklemez |

## Sonuçlar

- Yeni sağlayıcılar: `modules/payment-bank-transfer`, `modules/payment-cod`. İkisi de bölgeye migration betiğiyle eklenir (ortak `addRegionPaymentProvider`).
- Store ucu doğrulayıcısı `provider_id`'yi çevrim dışı sağlayıcılarla genişletir. `return_urls` yalnızca barındırılan formda zorunlu kalır.
- Kargo kuralı tek yerde toplanır. Test modunda ödenmiş sipariş engeli de bu kurala katılır.
- Sözleşme test paketi (ADR-0026 uygulama notu) "çevrim dışı" bir dalla genişler: başlatma, yetkilendirme durumu, onay, iptal, iade (havale/kapıda ödeme iadesi elle; sağlayıcı reddeder, mağaza panelden "elle iade edildi" kaydı tutar).
- Ek ücret kaleminin gönderiye ve faturaya yansıması F7 ve F8'de doğrulanır.
