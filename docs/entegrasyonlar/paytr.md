# PayTR Payment Provider

> F5'in sağlayıcısı (2026-10-27 sıra değişikliği; adr/0026). **Ana kaynak dev.paytr.com** (kullanıcı, 2026-10-27). Aşağıdakiler oradan 2026-10-27'de doğrulandı; hata kodları ve panel yolları V1'de yeniden okundu.
> "Doğrulanamadı" işaretli maddeler test hesabıyla kontrol edilir. Resmi Node SDK'sı yok; kendi istemcimiz `lib/payments/paytr` (`lib/clients` üzerine).

## Hesap bilgileri (panelden, adr/0027)
- Mağaza sahibi bilgileri Ayarlar > Ödeme'den girer: mağaza no (`merchant_id`), mağaza parola (`merchant_key`), mağaza gizli anahtar (`merchant_salt`), test modu. Parola ve gizli anahtar `integration-credentials` modülünde şifreli durur, bir daha gösterilmez.
- PayTR'de yeri: Mağaza Paneli > Destek & Kurulum > Entegrasyon Bilgileri, "API Entegrasyon Bilgileri" başlığı.
- **Bağlantı kontrolü:** uydurma bir `merchant_oid` ile durum sorgusu. `004` (işlem bulunamadı) bilgilerin doğru olduğunu gösterir; `001` mağaza no hatalı ya da pasif, `003` parola ya da gizli anahtar hatalı. Kayıttan önce, "Bağlantıyı test et"te ve sağlık kontrolünde kullanılır; panelden yapılanı 8 saniyede kesilir. Ağ/5xx "ulaşılamadı", belgelenmemiş yanıt "başarısız" sayılır (ADR-0027 §4).
- **Canlıya geçiş:** test ödemesinden sonra Destek & Kurulum > Canlı Mod > "Evet, Entegrasyonu Tamamladım" ve "Canlı Moda Geçiş Talebi Gönder". Onay SMS ve e-postayla gelir. Test işlemleri İşlem & Rapor > İşlemler'de e-postayla aranır.

## Akış (iFrame API)
```
Storefront: POST /store/carts/:id/payment-session (kendi ucumuz, adr/0026)
  → sunucu: sepet hazır mı + sepet/alıcı/IP/dönüş adresleri sunucudaki sepetten
  → createPaymentSessionsWorkflow → initiatePayment → POST /odeme/api/get-token → iframe token
  → oturumda: token, merchant_oid, beklenen tutar (kuruş), para birimi
Storefront: iframe https://www.paytr.com/odeme/guvenli/{token} (yüksekliği iframeResizer mesajlarıyla, aşağıda)
PayTR → Bildirim URL (POST /hooks/paytr)
  → hash (sabit zamanlı) → webhook-events kaydı (tekil) → durum sorgusu (authorizePayment)
  → tutar/para birimi oturumla eşleşiyor mu → cart complete (sepet kilidi) → düz metin "OK"
PayTR → tarayıcı: merchant_ok_url / merchant_fail_url (yalnızca bilgilendirme; sipariş onaylamaz)
```

## Çerçevenin yüksekliği (iframeResizer, 2026-11-05)
- **PayTR'ın istediği** (dev.paytr.com, iFrame API 1. adım, 2026-11-05'te okundu): `<script src="https://www.paytr.com/js/iframeResizer.min.js">`, `<iframe src="https://www.paytr.com/odeme/guvenli/{token}" id="paytriframe" frameborder="0" scrolling="no" style="width: 100%;">` ve `iFrameResize({},'#paytriframe')`. PayTR'ın sayfaları iframe-resizer'ın içerik betiğini çalıştırır; mağaza sayfası "ev sahibi" tarafı çalıştırmazsa çerçeve sabit kalır (telefonda 735 px'lik form 640 px'lik çerçevede içeriden kayıyordu).
- **Neden PayTR'ın dosyası yüklenmedi:** vitrin CSP'si `script-src`'i kendi nonce'lı koduna bırakır (`strict-dynamic`); `www.paytr.com`'u eklemek o hostun her betiğine izin vermek olur. Dosyanın kendisi (2026-11-05'te okundu) iframe-resizer'ın iki ayrı kopyasını taşır (`checkOrigin` varsayılanı kapalı) ve kaynağını denetlemeden `shrink`, `fastpay`, `shrink_iframe`, `pay_drawer_open` mesajlarını dinleyen bir `window.onmessage` kurar. Bu yüzden ev sahibi tarafı kendi kodumuzda: `@qticaret/ui` `lib/frame-resizer.ts` (protokol) + `components/payment-frame.tsx` (çerçeve); her tema bunu kullanır.
- **Protokol (iframe-resizer 2–3, PayTR'ın dosyası bu sürüm):** her sayfa yüklenince (`load`) ve bileşen bağlanınca çerçeveye `[iFrameSizer]paytriframe:8:false:false:32:true:true:null:bodyOffset:null:null:0:false:parent:scroll` gönderilir (PayTR'ın `iFrameResize({})` çağrısının gönderdiği varsayılanlar; içerik betiği bunu alana kadar susar). Çerçevenin genişliği değişince `[iFrameSizer]resize`. Sayfa `[iFrameSizer]paytriframe:<yükseklik>:<genişlik>:<tür>` yollar; yalnız bu çerçevenin penceresinden (`event.source`) ve çerçeve adresinin origin'inden gelen, boy bildiren mesaj alınır (`close`, `scrollTo`, `pageInfo`, `inPageLink`, `message`, `reset` yok sayılır). Bizim mesajlarımız yalnız PayTR'ın origin'ine gider (`postMessage` hedef origin'i); çerçeve bankanın sayfasındayken ona bir şey gitmez.
- **Sınırlar:** varsayılan 640 px (ilk mesajdan önce ve boy bildirmeyen sayfada: bankanın 3D Secure sayfası; her yüklemede buna döner, o sayfa gerekirse içeriden kayar), en az 360, en çok 4000 px. Yükseklik öğenin `style` nesnesiyle yazılır, `style` özniteliğiyle değil (CSP `style-src-attr` satır içi stili reddeder). CSP değişmedi: yalnız `frame-src` PayTR.
- **Sahte PayTR** (`packages/testing/src/paytr/page-parts.ts` `paytrPage`): kart formu ve PayTR'ın kendi sayfaları (sonuçlanmış/bulunmayan ödeme) aynı içerik tarafını çalıştırır: init'e kadar susar, sonra `init`, değişiklikte `mutationObserver`, pencere genişliğinde `resize`, ev sahibi sorunca `resizeParent`; yükseklik `bodyOffset` (gövde + kenar boşlukları). Bankanın 3D Secure sayfası (gerçekte bankanın) çalıştırmaz.
- **Doğrulama:** `apps/storefront/e2e/paytr-frame.e2e.ts` "the card form fits its frame…": 1280, 768 ve 390 px'te çerçeve sayfasının boyunda (içeride kaydırma yok), kart değişince (taksit listesi) çerçeve de değişir. 2026-11-05 ölçümü (sahte PayTR, test modu, Axess test kartıyla dolu form): 1280 ve 768'de 635 px, 390'da 1045 px.

## Ödeme başlatma (F5 V2, 2026-10-27)
- Sağlayıcı `pp_paytr_paytr` (`src/modules/payment-paytr`, medusa-config'te `id: "paytr"`). Hesap çağrı anında `@medusajs/framework`'ün paylaşılan `container`'ından okunur (adr/0027); kurucuda okunmaz, modüller o sırada henüz kayıtlı değil.
- Bölgeye bağlama: bootstrap yeni bölgeye `pp_system_default` ile birlikte ekler; `paytr-region-provider` migration betiği mevcut bölgelere, bölgenin kendi sağlayıcılarını koruyarak ekler (Medusa kümenin tamamını değiştirir). Hesap yoksa başlatma `paytr.not_configured` ile reddedilir.
- Uç: `POST /store/carts/:id/payment-session` gövde `{ provider_id, return_urls: { success, failure } }`. Dönüş adresleri `STORE_CORS` origin'lerinden biri olmalı (`payments.return_url_invalid`). Hız profili `checkout` (adres ve sepet başına).
- Sepet hazır mı: kalem, teslimat adresi, kargo yöntemi (gerekiyorsa), e-posta ve telefon; eksik olan alan adıyla döner.
- Sepet (`lib/payments/basket`): F4.7 payları, kredi satırları (hediye kartı, mağaza kredisi) satırlara dağıtılır, 0 TL satır çıkar, toplam ödeme koleksiyonu tutarına kuruşu kuruşuna eşit. Adede bölünmeyen satır PayTR'ye tek satır olarak "(N adet)" adıyla gider.
- Oturum verisi herkese açık: `checkout` (alıcı, sepet, IP) çıktıda boşaltılır; oturumda `token`, `form_url`, `merchant_oid`, `amount` (kuruş), `currency_code`, `test_mode`, `expires_at` kalır (HTTP testi).
- Medusa'nın `/store/payment-collections/:id/payment-sessions` ucu PayTR için 400 (`payments.use_checkout_route`); sağlayıcı da bizim ucumuzun `context` işareti olmayan başlatmayı reddeder.
- `authorizePayment` durum sorgusudur: ödeme yoksa `pending`, tutar/para birimi/test modu oturumla eşleşirse `captured`, değilse `error`. Ödenen sepet `/store/carts/:id/complete` ile siparişe dönüşür (HTTP testi). İade ve iptal V5'e kadar `paytr.refund_unavailable`.
- Taksit sınırı V6'ya kadar `max_installment: 0` (hesabın en çoğu).
- **Güvenlik incelemesi sonrası (2026-10-27):**
  - Medusa'nın çekirdek oturum ucu vitrine tamamen kapalı (sistem sağlayıcısıyla ödemesiz sipariş açılabiliyordu); havale ve kapıda ödeme F6'da kendi yolunu açar.
  - `/store/carts/:id/complete`, tutarı olan sepeti yalnızca barındırılan form oturumuyla tamamlar; `checkout` hız profili (sepet başına, adresten bağımsız da) bu uca da uygulanır.
  - Ödeme başlatma sepet kilidi altında (Medusa'nın sepet anahtarı). Sepet tamamlanırken sepet toplamı, ödeme koleksiyonu, canlı oturumlar ve formun kendi `amount` kaydı kuruşu kuruşuna eşit olmalı (`payments.cart_changed`; `lib/payments/consistency`).
  - Dönüş adresinde kullanıcı bilgisi ve ters bölü reddedilir, en çok 400 karakter; PayTR'ye ayrıştırılmış adres (`URL.href`) gider.

## Bildirim ve sipariş (F5 V3, 2026-10-27)
- Uç `POST /hooks/paytr` (form gövde, `webhook` hız profili). Sıra: alan doğrulama → kayıtlı hesap (yoksa 503) → imza sabit zamanlı (tutmazsa 400, "OK" yok) → `paytrNotificationWorkflow`.
- `merchant_oid` oturum kimliğine çevrilir (`payses01…` → `payses_01…`); bizim PayTR oturumumuz değilse 404, "OK" yok (paylaşılan hesapta başkasının bildirimi PayTR'de bekler).
- `webhook-events` modülü: sağlayıcı + `merchant_oid:status` tekil. İşlenmiş tekrar yalnızca "OK" alır; aynı anda işlenen tekrar 409 alır (PayTR sonra yeniden dener); başarısız olan yeniden işlenir, deneme sayısı artar. Özet yalnızca referans, durum, tutar, test modu, hata kodu; 90 gün sonra silinir (`webhook-events-retention`, her gece).
- Başarılı ödeme: `completeCartWorkflow` (Medusa'nın sepet kilidi) → `authorizePayment` durum sorgusuyla tutarı, para birimini ve test modunu oturumla karşılaştırır → sipariş. Tamamlanmış sepet aynı siparişi döner; iki eşzamanlı bildirim tek sipariş açar (HTTP testi).
- Tamamlama başarısızsa (PayTR kaydı henüz tutmuyor, kilit) olay "başarısız" kaydedilir, "OK" dönülmez; PayTR'nin yeniden denemesi işler. Sahipsiz ödemenin iadesi V4'te.
- Başarısız ödeme bildirimi: "OK", sepet değişmez, ödeme yeniden başlatılabilir.
- **Sahipsiz ödeme:** imzası mağazanın hesabıyla tutan, `payses…` biçimindeki ama oturumu artık olmayan referans (müşteri ödemeyi yeniden başlattı, eski token ödendi; PayTR token'ı geri alınamaz) "başarısız / `orphan_payment`" kaydedilir, hata seviyesinde loglanır (`paytr.payment_orphan`), 409 döner; "OK" yok, iadesi V4'te.
- Siparişten sonraki kayıt adımı hata verse de sipariş geri alınmaz (log). Başarısız olayın yeniden alınması koşullu güncellemeyle: iki eşzamanlı yeniden denemeden biri alır.
- Test modunda ödenen sipariş (ödeme verisinde `test_mode: true`) kargoya verilemez: kendi kargolama akışımız (`planShipmentStep`) ve Medusa'nın `/admin/orders/:id/fulfillments` ucu `orders.test_payment_not_shippable` ile reddeder. Panel rozeti V7'de.

## Sahipsiz ödeme ve uzlaştırma (F5 V4, 2026-10-27)
- Bildirim akışı siparişten önce PayTR'yi sorgular. Ödeme henüz görünmüyorsa "OK" yok (PayTR yeniden dener).
- **Sahipsiz ödeme:** oturumu silinmiş (`session_gone`), tutarı/para birimi/test modu oturumla tutmayan (`amount_mismatch`) ya da sepeti artık tamamlanamayan (`completion_failed`: sepetin kendi kuralları, stok) ödeme `payment-recovery` modülüne bir kez kaydedilir, yöneticilere zilde uyarı gider ve bildirime **"OK" denir**: PayTR, "OK" almamış ödemeyi iade etmez (`007`). Kilit, ağ gibi geçici hatalar sahipsiz sayılmaz; "OK" verilmez.
- **İade işi** (`payment-recovery`, 5 dakikada bir): önce durum sorgusu; iadelerde bizim referansımız (`R<merchant_oid>`) varsa iade yapılmış sayılır (cevabı kaybolmuş iade tekrarlanmaz). Yalnızca PayTR'nin gösterdiği, alındığı test moduyla aynı moddaki ödeme iade edilir (test anahtarıyla canlı ödeme iade edilmez). İade son adım; sonrasındaki kayıt hatası bir sonraki turda PayTR'nin kaydından bulunur. Her iade ve vazgeçiş denetim kaydına ve zile düşer; 10 denemede olmazsa "elle iade gerekli".
- **Uzlaştırma işi** (`paytr-reconcile`, 10 dakikada bir): 10 dakika ile 24 saat arası açık PayTR oturumları sorgulanır; ödenmiş olan, bildirimiyle aynı akıştan (aynı olay anahtarı) geçer, sonradan gelen bildirim yalnızca "OK" alır.

## İade ve iptal (F5 V5, 2026-10-27)
- **Sağlayıcı:** `refundPayment` önce durum sorgusu yapar (ödeme var mı, test modu oturumla aynı mı: test anahtarıyla canlı ödeme iade edilmez), aynı referansla yapılmış iade varsa tekrarlamaz, PayTR'nin mağazanın düzeltebileceği retlerini (`000/006/007/008/009/010/011`) Türkçe anahtara çevirir, iadeyi ödeme verisine (`refunds`) yazar. `cancelPayment` hiçbir şey yapmaz: ödeme her zaman yakalanmış sayılır, Medusa yakalanmış ödemeyi `refundPayment` ile geri verir; iptalde de iade etmek, sepet tamamlanamadığında çift iade olurdu.
- **Referans:** Medusa her iade denemesine yeni bir anahtar verir (`refund.id`). Bizim iade akışımız, isteğin kendi referansını ödeme verisine (`pending_refund`) yazar; sağlayıcı onu kullanır. Belirsiz sonuçta tekrar denenen iade PayTR'de bir kez yapılır.
- **Medusa'nın kendi iadesi** (sepet tamamlanamayınca geri verme; `pending_refund` yok, 2026-11-17): referans Medusa'nın denemeye özgü anahtarı değil; ödemenin, tutarın ve sırasınındır: `M<merchant_oid>A<kuruş>N<k>`. `k`, ödeme verisinin (`refunds`; Medusa sağlayıcının döndürdüğü veriyi ödemeye yazar) bu tutar için henüz kaydetmediği ilk sıradır. En çok 64 harf/rakam; uzarsa `merchant_oid`'nin sonu kısalır, tutar ve sıra kısalmaz. Veri yazılmadan tekrarlanan adım ya da ikinci çalıştırma aynı `N<k>`'yı PayTR'nin `returns[]` listesinde bulur, yeniden göndermez. Yanıtı yolda kaybolmuş iade de böyle kaydedilir. Veri yazıldıktan sonraki aynı tutarlı gerçek ikinci iade `N<k+1>` olur ve gönderilir. Kurtarma işinin (`payment-recovery`, `R<merchant_oid>`) aynı tutardaki iadesi bir kez yapılmış sayılır: bir PayTR iadesi en çok bir kayda karşılık gelir, veride zaten kayıtlı bir iade yeni isteğin kanıtı sayılmaz. Her iki yolda da PayTR'nin gösterdiği iadelerle birlikte ödenen tutarı aşacak iade hiç gönderilmez (`paytr.refund_exceeds_payment`); farklı tutarlı kısmi iadeler gönderilir.
- **Sipariş iadesi:** `POST /admin/orders/:id/refunds` (kalemlerin adetleri + kargo ya da serbest tutar, `reference`, not) ve `POST /admin/orders/:id/refunds/preview`. Tutar sunucuda: F4.7 payları ve `order-refunds` defteri; kalem adedi ve ödenen tutar aşılamaz, serbest tutar kalemlerin kalanını düşürür. Sipariş kilidi altında, Medusa'nın `refundPaymentWorkflow`'u ile. Denetim kaydında önce/sonra iade edilen ve iade edilebilir tutar.
- **Yarım kalan iade** (2026-11-17): İade akışı sağlayıcıdan sonraki bir adımda düşerse defter kaydı hemen `failed` yapılmaz; önce paranın gidip gitmediğine bakılır (`workflows/orders/refund-trace.ts`):
  - Ödeme verisindeki `refunds` kaydı bu referansı ve tutarı tutuyorsa sağlayıcı iadeyi yaptı ve Medusa kaydetti (`made`).
  - PayTR durum sorgusunun `returns[]` listesi referansı ve tutarı gösteriyorsa para gitti ama yanıt yolda kayboldu (`shown`). iyzico'da tüm parçalar yanıtlanmış ve toplamı tutara eşitse de `shown` sayılır.
  - iyzico'da yanıtlanmamış bir parça varsa (`partial`) ya da hiçbir şey okunamazsa (`unknown`) para gitmiş sayılır.

  Bu durumlarda kayıt `pending` / `refund_incomplete` kalır: kalemleri iade edilmiş sayılır, yeni anahtarla aynı kalemler ikinci kez iade edilemez. Paneli olan sağlayıcıda (PayTR, iyzico) zile ve e-postaya `payments.refund_incomplete` uyarısı gider; havale ve kapıda ödemede uyarı gitmez, çünkü onların kaydı iş tarafından kapatılır. Panelde iade "Doğrulanıyor: kaydı yarım" görünür.

  Kesin ret bir izin listesidir (`lib/payments/refund-refusal.ts`): çağrıyı yapan kod hatayı "ret" diye işaretler. Bu listede yalnız şunlar var: PayTR'nin `status != success` yanıtı, iyzico'nun kendi `failure` yanıtı, hiç gönderilmemiş çağrı (`circuit_open`; `url_not_allowed` değil, çünkü yönlendirme reddi de bu kodla gelir ve istek gitmiş olabilir) ve bizim kontrolümüzün `ValidationError`'ı (`iyzico.refund_outcome_unknown` hariç). Ret, Medusa'nın iade akışından çıkarken deftere `provider_refused` olarak yazılır; PayTR hiçbir şey göstermiyorsa kayıt hemen `failed` olur, iz okunamıyorsa asla `failed` olmaz. Okunamayan ya da imzası tutmayan yanıt (`invalid_response`, `signature_mismatch`), Medusa'nın kendi hataları ve geri kalan her şey belirsizdir. Yanıt kaybolduysa ya da belirsizse PayTR'nin boş görünmesi henüz kanıt değildir, çünkü kaydı yanıtın gerisinde kalabilir: kayıt `pending` / `refund_unconfirmed` olur ve uyarı gitmez. PayTR hesabı ya da `merchant_oid` okunamıyorsa, ya da PayTR bu tutarda referanssız bir iade gösteriyorsa durum `unknown` sayılır, `none` sayılmaz. Başka sağlayıcıda hiçbir şey görünmüyorsa iade gönderilmemiştir; kayıt `failed` olur.

  `order-refund-settle` işi (5 dakikada bir, `workflows/orders/settle-open-refunds.ts`) bu kayıtları ve bir çöküşün işaretsiz bıraktığı `pending` kayıtları (20 dakikadan eski) kimliğe göre sayfa sayfa yeniden okur. Hiçbir zaman iade göndermez:
  - `made` ya da `shown` ise aynı referansla, yalnız kapatma isteğiyle (`close_only`) kapatır. Kapattığı bir iptal iadesinin siparişi hâlâ iptal edilmemişse `payments.cancel_refund_order_open` uyarısı gider: "siparişi iptal edin, kargolamayın". `made` yolunda yalnız bu iadenin Medusa iadesine (ödeme verisindeki `refund_id`) bağlı sipariş hareketi eksikse yazılır; Medusa iptal iadelerini ödeme kimliğiyle yazdığı için hareket türüne değil kimliğe bakılır.
  - PayTR iki ayrı okumada, en az 15 dakika arayla hiçbir şey göstermezse kayıt `failed` olur ve kalemler serbest kalır.
  - Okunamıyorsa durumunu değiştirmez (işaretsizse `refund_incomplete` yapar). Kayıt bir saattir açıksa `payments.refund_unresolved` uyarısı gider.
  - Personel, sipariş sayfasındaki yarım iadeye tıklayıp sağlayıcının panelinde gördüğünü işaretler (`POST /admin/orders/:id/refunds/:reference/settle`, iade yetkisi, hız sınırı, denetim kaydı). Pencere sağlayıcıyı, referansı, tutarı, tarihi ve iyzico parçalarını gösterir; seçim bir kez daha onaylatılır. Bu eylem iade göndermez.
    - "Para gitti" kaydı kapatır. Medusa'nın iade kaydı eksikse yazılır; ödemenin kalanı yetmiyorsa 409 döner ve aynı nottaki önceki deneme yeniden kullanılır. Koleksiyonun `refunded_amount` alanı Medusa'nın yaptığı gibi güncellenir, sipariş hareketi onarılır. iyzico'da yanıtı gelmemiş parçalar `done` olur, ama parçaların toplamı tutara eşit olmalıdır. Sıra bilinçlidir: önce parçalar, sonra Medusa kaydı ve hareket, sonra `pending_refund` adının kaldırılması, en son kaydın durumu. Arada kesilirse iz `shown` olur ve iş kaydı kapatır. Kapatılan her kayıtta kalan `sending` parçalar `done` yapılır.
    - "Para gitmedi" kaydı başarısız yapar ve kalemler serbest kalır; yanıtı gelmemiş iyzico parçaları kaldırılır, böylece ödemenin sonraki iadeleri yeniden yapılabilir. İz `made`/`shown` gösteriyorsa ya da yanıtlanmış bir parça varsa 409 döner.
    - Bir kısmı yapılmış iade (yanıtlanmış parça var, toplam eksik) elle sonuçlandırılamaz: kalanı gönderilmesi gerekir ve açık iade asla yeniden gönderilmez. Bu durumda sağlayıcının destek ekibiyle kontrol edilir.

  Aynı referansla yeniden deneme açık bir iadeyi asla yeniden göndermez. Veride kayıtlıysa yalnız defteri kapatır. Sağlayıcı gösteriyorsa sağlayıcı iadeyi `returns[]` listesinde bulup kaydeder. Bunların dışında `orders.refund_unsettled` (409) döner. Yalnız `failed` kayıt, istekten yeniden planlanarak gönderilir. iyzico, havale ve kapıda ödeme sağlayıcıları da iadeyi ödeme verisine aynı biçimde yazar; kayıt Medusa iadesinin kimliğini de (`refund_id`) taşır.
- **Ödeme verisinde ad:** Medusa ödeme verisini günceller ama birleştirerek yazar (`mergeObjectProperties`). Bu yüzden `pending_refund` anahtarı silinemez; iade bitince `null` yazılır.
- **Panel anahtarı:** `POST /admin/orders/:id/refunds` yalnız panelin ürettiği 32 küçük hex karakterlik anahtarı kabul eder. İptalin, iadenin, Medusa'nın ve kurtarma işinin referansları bu uçtan verilemez.
- **İptal:** Medusa'nın iptali iade başarısız olsa da siparişi iptal ediyor (hata loglanıp yutuluyor). Bu yüzden çekirdek `POST /admin/orders/:id/cancel` ucunun önünde ödemeli sipariş önce bizim akışımızla iade edilir (`workflows/orders/cancel-refunds.ts`); iade başarısızsa iptal yapılmaz.
  - Siparişin açık iadeleri önce kapatılır. Önceki iptal denemesinden kalan bir iade aynı referansla yeniden denenir. Başka bir açık iade para kesin geri döndüyse kapatılır; değilse iptal `orders.refund_unsettled` ile bekler.
  - Ardından para kalan her ödeme kendi referansıyla iade edilir: `cancel<ödeme kimliği>`. Yeniden denenen iptal her ödemeyi bir kez iade eder (güvenlik incelemesi Y1). Bir referans başka bir ödemenin kaydını kapatamaz.
  - Son olarak iade kilidi altında siparişin hiçbir ödemesinde `pending_refund` bırakılmaz.

  Medusa'nın `POST /admin/payments/:id/refund` ucu PayTR ödemelerine kapalı.
- **Panel:** sipariş detayında "Para iadesi" (ürün seçerek ya da tutar girerek; tutar önizlemeden, her açılışta yeni anahtar).

## Taksit (F5 V6, 2026-10-27)
- **Mağaza ayarı:** `payments` ayar bölümü: `installments_enabled` (varsayılan açık), `max_installment` (0 = hesabın izin verdiği en çok, ya da 2–12). Panelde Ayarlar > Ödeme > Taksit. Sağlayıcı ödeme başlatırken okur: kapalıysa `no_installment=1`, açıksa `max_installment` bu sınır.
- **Taksit tablosu:** `GET /store/payment/installments?variant_id=&region_id=` ya da `?cart_id=` (yayınlanmış ve vitrinin kanalındaki ürün/sepet; tutar sunucuda: varyantın bölgedeki hesaplanan fiyatı ya da sepet toplamı). Kart ailesi başına seçenekler: adet, oran, toplam, taksit tutarı (toplam = tutar × (100 + oran) / 100). Sınır: mağazanınki ve PayTR'nin `max_inst_non_bus`'ı. Hız profili `installment`.
- **Oranlar:** `taksit-oranlari` her süreçte hesap başına günde bir kez sorulur (bellekte; plan Redis diyordu, amaç sayfa başına PayTR'ye gitmemek ve süreç başına günde bir çağrı bunu karşılıyor). Sorulamazsa dünkü oranlar kullanılır. Hesap (mağaza no, test modu) değişince yeniden sorulur.
- Doğrulanmadı: yalnızca iFrame kullanan bir hesabın oran API'sine erişimi (gerçek testler sunucuya kaldı); erişim yoksa tablo kapalı döner, ödeme formu taksitleri kendisi gösterir.

## Uçlar ve imzalar
Tüm imzalar `base64(HMAC-SHA256(key = merchant_key, mesaj))`.

| İş | Uç | İmza mesajı |
|---|---|---|
| Token | `POST https://www.paytr.com/odeme/api/get-token` | `merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode + merchant_salt` |
| Bildirim (gelen) | Bizim `POST /hooks/paytr` | `merchant_oid + merchant_salt + status + total_amount` |
| Durum sorgusu | `POST https://www.paytr.com/odeme/durum-sorgu` | `merchant_id + merchant_oid + merchant_salt` |
| İade | `POST https://www.paytr.com/odeme/iade` | `merchant_id + merchant_oid + return_amount + merchant_salt` (`reference_no` imzada yok) |
| Taksit oranları | `POST https://www.paytr.com/odeme/taksit-oranlari` | `merchant_id + request_id + merchant_salt` |
| BIN | `POST https://www.paytr.com/odeme/api/bin-detail` | `bin_number + merchant_id + merchant_salt` |

İstekler form-encoded gönderilir (resmi örnekler). `test_mode` isteğe bağlı ama imzada; her zaman gönderilir.

## Alan kuralları
- **`merchant_oid`:** yalnızca harf ve rakam, en çok 64, işlem başına tekil. Medusa oturum kimliği alt çizgi içerdiği için olduğu gibi kullanılamaz; alt çizgisiz hali kullanılır (`payses01J…`, adr/0026).
- **Tutar biçimleri karışık; çeviri tek modülde (`lib/money` sınırı):**
  - `payment_amount` (token) ve bildirimdeki `total_amount`/`payment_amount`: kuruş tam sayı (34,56 TL → `3456`).
  - `user_basket` satır fiyatı ve iade `return_amount`: TL ondalık metin, nokta ile (`"18.00"`, `"11.97"`).
  - Durum sorgusu tutarları: örneklerde hem `"10,8"` hem `"9.76"`; okuyucu ikisini de kabul eder.
- **`user_basket`:** `base64(JSON.stringify([[ad, birim_fiyat, adet], …]))`. Toplamın `payment_amount`'a eşit olma şartı, 0 TL satır ve yalnızca gösterim mi olduğu: doğrulanamadı. Bizim kuralımız: satırlar toplamı tutara eşit, 0 TL satır yok (iyzico ile aynı sepet kurucusu).
- **Token yanıtı:** başarı `{"status":"success","token":"…"}`, red `{"status":"failed","reason":"Zorunlu alan degeri gecersiz: merchant_id"}`. `reason`'dan yalnızca alan adı tutulur (`token_refused_<alan>`); metnin geri kalanı alışveriş bilgisi taşıyabilir. `debug_on` yalnızca test modunda 1.
- **`user_ip`:** müşterinin gerçek IP'si; yanlışsa "geçersiz paytr_token". Alan 39 karakter (IPv6 uzunluğu) ama "ipv4" diye etiketli; IPv6: doğrulanamadı. Yerel testte dış IP gönderilmeli.
- **`email`:** en çok 100, Türkçe karakter yok. `user_name` 60, `user_address` 400, `user_phone` 20, ok/fail URL'leri 400 karakter.
- **`max_installment`:** 0 (hesabın izin verdiği en çok) ya da 2–12; `no_installment` 1 ise taksit gösterilmez. iFrame taksitleri kendisi gösterir.
- **`timeout_limit`:** dakika, varsayılan 30. Süre dolarsa ya da sayfa kapanırsa `failed_reason_code` 6 ile başarısız bildirimi gelir. Token ömrü: doğrulanamadı.
- **Para birimleri:** TL (TRY), EUR, USD, GBP, RUB. 1 TL altı işlem yapılamaz.

## Bildirim (Bildirim URL)
- Adres **mağaza hesabı başına tek**, panelden ayarlanır (Destek & Kurulum > Ayarlar > Bildirim URL Ayarları); istek başına verilemez. Aynı hesabı kullanan dev, staging ve canlı aynı adrese düşer. Bizim panelimiz adresi (`{mağaza adresi}/hooks/paytr`) kopyalanabilir gösterir.
- Oturum/giriş gerektirmemeli; SSL yoksa HTTPS adresi verilmemeli.
- Alanlar: `merchant_oid`, `status` (success/failed), `total_amount`, `hash`, `failed_reason_code`, `failed_reason_msg`, `test_mode`, `payment_type` (card/eft), `currency`, `payment_amount`. Taksit sayısı alanı yok (durum sorgusunda `taksit` var).
- **İmza yalnızca `merchant_oid`, `status`, `total_amount`'u kapsar;** diğer alanlar imzasız, oturumdaki kayıtla ve durum sorgusuyla karşılaştırılır.
- `total_amount`, vade farkı olan taksitte `payment_amount`'tan büyük olabilir; muhasebede `total_amount`.
- Yanıt yalnızca düz metin `OK`. "OK" alınmazsa PayTR bir süre tekrar dener (aralık ve süre: doğrulanamadı); işlem "Devam Ediyor"da kalır, durmuş bildirimler panelden yeniden başlatılabilir.
- Aynı sipariş için birden fazla bildirim gelebilir: ilki işlenir, sonrakilere yalnızca "OK" (`webhook-events`).
- Başarısız bildirime de "OK" dönülür.
- `failed_reason_code`: `0` değişken (mesajı oku, ör. limit), `1` telefon girilmedi, `2` SMS kodu hatalı, `3` güvenlik kontrolü onaylanmadı, `6` müşteri vazgeçti ya da `timeout_limit` doldu, `8` kartta taksit yok, `9` mağaza bu kartla ödeme alamaz, `10` 3D Secure zorunlu, `11` dolandırıcılık uyarısı, `99` teknik entegrasyon hatası (`debug_on` 0 iken).
- PayTR'nin IP listesi yayımlanmamış (IP allowlist yok; imza + hız sınırı).

## Durum sorgusu
- Başarılı yanıtta `payment_amount`, `payment_total`, `currency`, `taksit`, `kart_marka`, `masked_pan`, `odeme_tipi`, `test_mode`, `net_tutar`, `kesinti_tutari`, `returns[]` (her iade: `return_amount`, `return_date`, `reference_no`, …).
- Ayrıca `payment_date`, `auth_code`, `auth_date`. `payment_amount` ve `payment_total` virgüllü (`"10,8"`), `net_tutar` ve `kesinti_tutari` noktalı (`"9.76"`).
- Hata: `status: "error"`, `err_no`, `err_msg`. `001` geçersiz istek / mağaza no yok / mağaza pasif, `002` `merchant_oid` hatalı, `003` `paytr_token` hatalı, `004` hem "işlem bulunamadı" hem "başarılı ödeme bulunamadı": sorgu yalnızca başarılı ödemeyi doğrular.
- Kullanım: `authorizePayment` (bildirimden sonra yeniden sorgu, docs/04), sonucu belirsiz çağrılar ve bildirimi gelmeyen oturumlar için uzlaştırma işi.
- Panelde gösterilecek kart bilgisi buradan: marka ve `masked_pan`'den yalnızca son 4 hane saklanır.

## İade
- `merchant_oid` + `return_amount` (TL ondalık) + isteğe bağlı `reference_no` (en çok 64, harf/rakam). Tam ve kısmi iade var; birden çok kısmi iade, toplamı ödemeyi geçmedikçe (`009`).
- İptal API'si yok: aynı gün de iade ucu kullanılır; `cancelPayment` tam iadedir.
- Hata kodları (dev.paytr.com/hata-kodlari): `000` servis ödeme aktarımı sırasında kilitli (sonra dene), `001` geçersiz istek / mağaza pasif, `002` `merchant_oid` hatalı, `003` `return_amount` hatalı, `004` `paytr_token` hatalı, `005` başarılı ödeme yok, `007` ödeme henüz siteye onaylanmadı (bildirim "OK" almadan iade olmaz), `008` ödeme türü iadeyi desteklemiyor, `009` toplam iade ödemeyi aşıyor, `010` net bakiye yetersiz, `011` bir yıldan eski işlem. İade sayfası aşımı `006` diye anıyor; ikisi de aynı anahtara eşlenir.
- Aynı numara API'ye göre farklı anlam taşır (`004` iadede hatalı token, sorguda bulunamadı); eşleme API başına ayrı tablodur (`lib/payments/paytr/errors.ts`).
- İdempotency belgelenmemiş: `reference_no` = iade kaydının kimliği (harf/rakam); sonuç belirsizse yeniden denemeden önce durum sorgusunun `returns[]` listesinde aranır.
- Yanıtta `status` "success", `is_test` (test işlemi 1), `merchant_oid`, `return_amount`, gönderildiyse `reference_no`. Hata hem "failed" (sipariş yok) hem "error" olarak geçiyor, ikisi de karşılanır.
- İstemci iadeyi kendiliğinden yeniden göndermez: yanıt kaybolursa `outcome_unknown` döner, çağıran `reference_no`'yu durum sorgusunda arar.

## İşlem Dökümü (mutabakat, F11.3, 2026-10-29)
- **Uç:** `POST https://www.paytr.com/rapor/islem-dokumu` (dev.paytr.com/islem-dokumu). Form alanları `merchant_id`, `start_date`, `end_date` (`YYYY-MM-DD hh:mm:ss`), `paytr_token`. Aralık **en fazla 3 gün**.
- **İmza:** `base64(HMAC-SHA256(merchant_key, merchant_id + start_date + end_date + merchant_salt))`. Resmî Postman koleksiyonu da bu sırayı kullanıyor.
- **Yanıt:**
  - `success`: satırlar `islem_tipi` (`S` satış, `I` iade), `islem_tutari`, `odeme_tutari`, `net_tutar`, `kesinti_tutari`, `kesinti_orani`, `islem_tarihi` (`13.01.2021`), `para_birimi`, `taksit`, `kart_marka`, `kart_no` (maskeli), `siparis_no` (= `merchant_oid`), `odeme_tipi` alanlarını taşır.
  - `failed`: aralıkta işlem yok.
  - `error`: `err_no` ve `err_msg`; numaralar belgelenmemiş, `error_<no>` olarak görünür kalır.
- **Belgelenmeyen:** satırları hangi anahtarın tuttuğu ne sayfada ne Postman'de var; resmî örnekler yanıtı olduğu gibi basıyor. Okuyucu yanıttaki her diziyi ya da satır alanı taşıyan her nesneyi satır sayar, satırın kendisini sıkı okur. Okunamayan tek satır bütün dökümü `invalid_response` yapar.
- **Tutar:** `islem_tutari` ile `odeme_tutari`'ndan hangisinin vade farkını içerdiği belgelenmemiş. Satış, ikisinden biri mağazanın tutarına eşitse tutar sayılır.
- **İstemci:** rapor ayrı bir HTTP istemcisinden gider (60 sn zaman aşımı, 20 MB yanıt, kendi devre kesicisi). Resmî örnek 90 sn bekliyor; yavaş rapor ödeme çağrılarının devre kesicisini açmaz.
- **Gözden geçir:** satırları tutan anahtar ve vade farkının hangi alanda olduğu ilk canlı hesapta doğrulanır.

## Taksit
- Oran API'si (`taksit-oranlari`) BIN istemez; ürün sayfası için genel tablo alınabilir. Oranlar günlük değişebilir: günde bir çekilip saklanır.
- Yanıt: `status`, `request_id`, `max_inst_non_bus` (mağazanın en çok taksiti), `oranlar` (kart ailesi: axess, world, maximum, cardfinans, paraf, advantage, combo, bonus). `oranlar`'ın iç yapısı belgelenmemiş; bilinen biçim `{aile: {taksit_<n>: oran}}`, istemci buna göre okur (doğrulanamadı, V6). Eksik alanda `err_no` `006`.
- Bu API Direkt API başlığı altında belgeli; yalnızca iFrame kullanan hesabın erişimi: doğrulanamadı (test hesabıyla). Erişim yoksa PayTR panelinin gömülebilir "taksit tablosu" kodu storefront'a (F18) bırakılır.
- BIN sorgusu yalnızca storefront kart numarası alanı olmadığı için F5'te kullanılmaz.

## Kayıtlı kart
Yalnızca Direkt API'de: kart bilgisi bizim sayfamızdaki formdan PayTR'ye gönderilir (SAQ-A dışı). Kapsam dışı (adr/0026).

## Test modu
- Ayrı test ortamı ya da ayrı test anahtarı belgelenmemiş: `test_mode=1` canlı `merchant_id`/`merchant_key`/`merchant_salt` ile çalışır. Yeni mağaza "Canlı Moda Geçiş Talebi" onaylanana kadar test modundadır.
- Bildirim adresi tek olduğu için **canlı satış yapan bir hesapla dev'de test edilemez** (canlı bildirimler dev'e gider). Test için ayrı mağaza ya da canlıya geçmemiş hesap gerekir (docs/12).
- Dev'de bildirim için herkese açık adres (tünel) gerekir.
- iFrame test kartları formda hazır gelir; başarılı/başarısız/3DS kartları: doğrulanamadı.

## Ters ibraz
PayTR'de ters ibraz API'si ya da bildirimi bulunamadı; F6.7 PayTR için elle kayıtla çalışır.

## Güvenlik notları
- Hash karşılaştırması `timingSafeEqual` (resmi örnekler `!=` kullanıyor; kopyalanmaz).
- `merchant_key` ve `merchant_salt` hiçbir istek gövdesine girmez (resmi Node örneği gönderiyor; kopyalanmaz).
- İstemci IP'si `trust proxy` ile çözülmüş `req.ip`'den; `X-Forwarded-For`'u doğrudan okumak yok (resmi PHP örneği okuyor).
- Log redaksiyonu: `merchant_key`, `merchant_salt`, `paytr_token`, `token`, `hash`, `utoken`, `ctoken`.

## Env
Hesap bilgileri env'de değil, panelde (adr/0027). Env'de yalnızca:
- `CREDENTIALS_ENCRYPTION_KEYS` (ya da tek anahtarlı `CREDENTIALS_ENCRYPTION_KEY`): hesap bilgilerinin zarflarını saran anahtar(lar) (canlıda zorunlu; döndürme docs/08, adr/0061 Ek C17).
- `PAYTR_BASE_URL`: yalnızca geliştirici makinesinde ve testte sahte sunucu için; canlıda ve staging'de tanımlıysa açılış reddedilir. Gerçek adres kodda sabit (`https://www.paytr.com`).

## Geliştirmede elle deneme (ADR-0028)
Gerçek PayTR `localhost`'a bildirim gönderemez; ilk müşterinin canlı hesabı da bildirimleri firmanın kendi sistemine yollar. Yerelde ödeme bu yüzden sahte PayTR'yle denenir:
1. `pnpm dev:paytr`: sahte PayTR `127.0.0.1:9102`'de açılır, bildirimleri `http://localhost:9000/hooks/paytr`'ye yollar. Açılırken panelde girilecek hesabı yazar (mağaza no `100001`; parola ve gizli anahtar okunur, uydurma değerler: gerçek PayTR reddeder, gizli bilgi tarayıcıları (gitleaks) gerçek sanmaz).
2. Backend `PAYTR_BASE_URL=http://127.0.0.1:9102` ile çalışır (`env.example`'da var; eski `.env`'lere bir satır eklenir).
3. Panel > Ayarlar > Ödeme > PayTR'de bu hesap test moduyla kaydedilir (bir kez; dev veritabanında kalır).
4. Vitrin (`http://localhost:8000`): ürün → sepet → `/odeme` (adres → kargo → kart) → `/odeme/kart` sahte PayTR formu (iFrame) → "Ödemeyi onayla" → `/odeme/sonuc` siparişi bekler → `/siparis/:id`. (adr/0028'in deneme sayfası 2026-11-02'de kaldırıldı.)

Sahte formun üç düğmesi, mağazanın karşılaşacağı üç sonuçtur: **Ödemeyi onayla** (taksit seçilebilir, vade farkı `total_amount`'a eklenir; imzalı bildirim gider, sipariş açılır), **Kart reddedildi** (başarısız bildirim, hata adresine dönüş, sepet açık kalır, yeniden ödenebilir), **Ödendi, bildirim kayboldu** (bildirim gitmez; sipariş, `paytr-reconcile` işi PayTR'ye sorunca açılır: oturum 10 dakika sessiz kaldıktan sonraki ilk turda, yani 10–20 dakika içinde). HTTP testi `paytr-payment-form.spec.ts` aynı formu gerçek backend'e karşı sürer.

## Testler
İmzalar bilinen-cevap vektörleriyle test edilir (Python `hmac` ve `openssl` ile ayrıca hesaplandı). Sahte sunucu imzaları kendi kodumuzdan bağımsız, dokümana göre doğrular; test hesapları her çalıştırmada üretilir (`fakePaytrAccount`).
Sahte sunucu senaryoları (`packages/testing`): başarı, taksitli başarı (vade farkı), 3DS başarısız, zaman aşımı (kod 6), mükerrer bildirim, imzası bozuk bildirim, tutarı farklı ödeme, bayat oturuma gelen ödeme, kısmi iadeler ve `009`, `007`, `010`, 5xx/timeout (belirsiz sonuç → durum sorgusu).
