# apps/backend — Medusa v2

## Klasörler (Medusa konvansiyonu — dışına çıkma)

- `src/modules/<ad>/` — özel modüller ve module provider'lar (models, service.ts, index.ts, migrations)
- `src/workflows/<alan>/` — workflow'lar; `steps/` alt klasöründe adımlar
- `src/api/admin/...`, `src/api/store/...`, `src/api/hooks/...` — route.ts dosyaları; `middlewares.ts`
- `src/subscribers/` — event dinleyicileri (ince; workflow çağırır)
- `src/jobs/` — zamanlanmış işler
- `src/links/` — modüller arası link tanımları
- `src/admin/widgets`, `src/admin/routes` — admin genişletmeleri
- `integration-tests/` — http ve modül testleri

## Kurallar

- Provider'lar `AbstractPaymentProvider`, `AbstractFulfillmentProviderService`, `AbstractNotificationProviderService` üzerinden.
- Modüller izoledir: bir modül başka modülün servisini doğrudan çağırmaz. Çapraz iş = workflow + link.
- Module provider'lar da izoledir: sadece kendi modülünün container'ına erişir. Mağazanın sağlayıcı hesabını (`integration-credentials`) çağrı anında `@medusajs/framework`'ün paylaşılan `container`'ından okur (adr/0027); hesap bilgisi `data`'ya ya da `context`'e konmaz. Dar istisnalar (adr/0027 ek, 2026-10-27): iyzico sağlayıcısı iade defterine (`order-refunds`) iade parçalarını yazar ve `payment-recovery`'yi okur; Aras, Yurtiçi, DHL eCommerce, Sürat ve PTT kargo sağlayıcıları mağazanın ağırlık/ölçü birimlerini ve desi ücret tablosunu (`platform-settings` `store`, `shipping`) okur (adr/0031, adr/0035; `lib/shipping/shop.ts`); DHL eCommerce etikete gönderici basmak için mağazanın zaten herkese açık künyesini de okur (`legal` unvan ve adres, `store` telefon; `shopSender`); e-posta sağlayıcısı (`notification-email`), mağazanın SMTP sunucusu bir adresi kalıcı olarak reddedince (`recipient_rejected`) adresi `messaging` bastırma listesine yazar, ret çoğalınca (fren) geri alır ve `messaging.smtp_rejections_tripped` olayını yayar (adr/0036 Ek 2026-11-10; `lib/messaging/email/smtp-bounce.ts`); başka modül erişimi yok.
- Kargoya verirken sert engel yalnız taşıyıcının gerçek reddi, müşteriye bozuk çıktı ya da para/güvenlik içindir. Alıcı ve gönderici boşlukları workflow'da doldurulur (`lib/shipping/fill.ts`; tr-address workflow'da okunur, sağlayıcıda değil). Yeni bir kargo kontrolü taşıyıcının belgesini kaynak gösterir (adr/0054 ek 2026-11-05).
- Route'larda `validateAndTransformBody` + Zod şeması zorunlu.
- Dış API istemcileri `src/lib/clients/` altında, timeout + retry + log redaksiyonu ile.
- Tutar dönüşümleri (ör. iyzico'nun string tutarı) sadece provider sınırında yapılır.
- Kargo (adr/0054): ürünün ağırlığı ve ölçüleri isteğe bağlıdır; yayın ve içe aktarma onları beklemez. Eksik değer (boş ya da 0) platform-settings `shipping.default_parcel`'dan alınır (kaydedilmemişse platformun 1 kg, 30 × 20 × 10 cm paketi, mağazanın birimine çevrilir); hesap `lib/shipping/parcel.ts`'tedir. Desiyi taşıyıcı ölçer: Yurtiçi'ye ölçüsüz kolide desi/kg gönderilmez, uydurma değer yazılmaz. DHL eCommerce'in parça listesi desi ve kg'ı zorunlu ve tam sayı ister: ölçüsüz kolide mağazanın varsayılan paketi (yukarı yuvarlanmış) gider, DHL şubede ölçer (gerçek hesapla doğrulanacak). Sürat'a da Yurtiçi gibi ölçüsüz kolide desi/kg boş gider; PTT'ye de (gram, desi ve cm gönderilmez). PTT'nin barkodu sağlayıcıda değil ship workflow'unda mağazanın aralığından alınır (`ptt-barcode` modülü, `qt_ship.barcode`).
- Yeni modül → `/yeni-modul`, yeni provider → `/entegrasyon-provider` komutunu kullan.
