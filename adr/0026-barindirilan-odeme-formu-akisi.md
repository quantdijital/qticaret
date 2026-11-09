# ADR-0026: Barındırılan ödeme formlarında ödeme akışı

- **Durum:** Kabul edildi (2026-10-27, F5 V1 başında; kullanıcı itiraz etmedi, kalıcı "önerileni uygula" talimatı). Sağlayıcı bilgileri ve test modu ADR-0027 ile panelden gelir.
- **Tarih:** 2026-10-27

## Bağlam

F5'te iki sağlayıcı yazılır, önce PayTR. Kullanıcı 2026-10-27'de ilk müşterinin PayTR ile çalıştığını söyledi. iyzico'ya başvuru sürüyor; altyapısı aynı fazda hazırlanır, canlıya alınması sonra. İki sağlayıcıda da kart bilgisi sağlayıcının kendi sayfasında girilir: PayTR iFrame'i, iyzico Checkout Form'u. Böylece PCI kapsamı SAQ-A'da kalır (docs/04). Bu ADR akışın sağlayıcıdan bağımsız kısmını belirler; iyzico PayTR'den sonra aynı kalıba oturur.

**Medusa 2.21.2'de doğrulananlar** (v2.21.2 etiketinin kaynağı; ayrıntı PROGRESS "F5 görev planı"):

- **Sağlayıcı izole.** Sepete, adrese ve bizim modüllerimize ulaşamaz. Eline `amount`, `currency_code`, `data` ve `context` geçer. `context` giriş yapmış müşteriyi ve `idempotency_key`'i taşır.
- **Oturum verisi istemciden gelebiliyor:**
  - `POST /store/payment-collections/:id/payment-sessions` istemciden serbest `data` alır. Bu veri sağlayıcıya gider; sağlayıcı üzerine yazmadığı anahtarlar oturumda kalır.
  - Oturumun `data`'sı Store yanıtlarında alışverişçiye görünür.
  - Uçta sahiplik kontrolü, workflow'da kilit ve hook yok.
- **Tutar karşılaştırması yok.** Medusa ödenen tutarı sepet toplamıyla hiçbir yerde karşılaştırmıyor.
- **Sepet değişince oturum silinir:**
  - Sepet toplamı değişince oturumlar silinir; `updatePayment` çağrılmaz.
  - Silme işlemi sağlayıcının `deletePayment`'ını çağırır. Bu metot hata fırlatırsa sepet güncellemesi de başarısız olur.
- **Hazır webhook ucu güvensiz.** `/hooks/payment/:provider` gövdeyi doğrulamadan 200 döner. İşi 5 sn gecikmeli bir olayla, en çok 3 denemede yapar. `processPaymentWorkflow`'da kayıt ve idempotency yok.
- **Sepet tamamlama:**
  - `completeCartWorkflow` sepet kilidi (30 sn) ve `order_cart` kontrolüyle aynı sepete ikinci sipariş açmaz.
  - Sipariş, ödeme yetkilendirilmeden önce oluşur. Yetkilendirme başarısız olursa sipariş geri alınır.
- **Sağlayıcı çıktısı veriyi değiştirir.** Sağlayıcının her çıktısı (yetkilendirme, tahsilat, iade, iptal) `payment.data`'nın tamamının yerine geçer.
- **Çift geri ödeme riski.** Yetkilendirmeden sonraki bir adım hata verirse telafi zinciri önce `cancelPayment`'ı, ardından iade adımını çağırabilir. Bu kaynaktan çıkarımdır; testle doğrulanacak.

**PayTR'de doğrulananlar** (dev.paytr.com, 2026-10-27; ayrıntı docs/entegrasyonlar/paytr.md):

- **Onay yalnızca bildirimle.** Siparişi yalnızca bildirim (Bildirim URL) onaylar; ok/fail adresleri yalnızca tarayıcı yönlendirmesidir. Bildirim adresi mağaza hesabı başına tektir ve panelden ayarlanır.
- **Bildirim imzası dar.** İmza yalnızca `merchant_oid`, `status` ve `total_amount` alanlarını kapsar. Aynı bildirim birden çok kez gelebilir ve "OK" alınana kadar tekrarlanır.
- **`merchant_oid` biçimi.** Yalnızca harf ve rakam içerebilir, en çok 64 karakter.
- **Durum sorgusu ve iade.** Durum sorgusu yalnızca başarılı ödemeyi doğrular. İadede idempotency belgelenmemiş; iadenin `reference_no`'su durum sorgusunda döner.
- **Test ortamı yok.** Test modu canlı anahtarlarla çalışır.

## Karar

1. **Ödeme oturumunu kendi Store ucumuz açar.**
   - Uç: `POST /store/carts/:id/payment-session`. Önce sepetin tamamlanmaya hazır olduğuna bakar: adres, kargo yöntemi ve kalemler.
   - Sepet (`lib/payments/basket`, F4.7 payları), alıcı, istemci IP'si ve dönüş adresleri sunucuda kurulur. `createPaymentSessionsWorkflow` bu veriyle çağrılır.
   - Tutar her zaman ödeme koleksiyonundan gelir: kredi satırları düşülmüş sepet toplamı.
   - Çekirdek `payment-sessions` ucu, barındırılan form kullanan sağlayıcılar için 400 döner.
2. **Oturum verisi herkese açık sayılır.**
   - Sağlayıcı, girdideki alıcı ve sepet anahtarını çıktısında boşaltır.
   - Oturumda yalnızca şunlar kalır: form token'ı, sağlayıcı referansı, kuruş cinsinden beklenen tutar, para birimi ve geçerlilik sonu. Kişisel veri ve sır kalmaz (testli).
   - `context`'in Store yanıtına sızmadığı testle kanıtlanır. Sızıyorsa alan kısıtlanır.
3. **Sağlayıcı referansı oturumdan türetilir.**
   - PayTR'de `merchant_oid`, oturum kimliğinin alt çizgisiz halidir (`payses01J…`). iyzico'da `conversationId` oturum kimliğinin kendisidir.
   - Ek eşleme tablosu yok. Her ödeme denemesi yeni bir oturum, dolayısıyla yeni bir referanstır.
4. **Onay, sağlayıcı yeniden sorgulanarak sunucuda verilir.**
   - Bildirim yalnızca tetikleyicidir. `authorizePayment` sağlayıcıyı sorgular: PayTR'de durum sorgusu, iyzico'da Checkout Form sonucu.
   - Tutar ve para birimi, oturumdaki beklenen değerle karşılaştırılır. Eşleşirse `captured` döner; iki sağlayıcı da parayı anında çeker.
5. **Bildirim ucu bizimdir.**
   - Uç `POST /hooks/paytr`; iyzico'nun uçları `/hooks/iyzico/...` altına gelir. Medusa'nın `/hooks/payment/:provider` ucu kullanılmaz.
   - İşleme sırası:
     1. hız sınırı (`webhook` profili);
     2. sabit zamanlı imza kontrolü;
     3. `webhook-events` kaydı (sağlayıcı + olay anahtarı tekil; docs/04'teki `processed_webhooks`);
     4. senkron işleme: sepet kilidi altında yetkilendirme ve sepet tamamlama;
     5. "OK" yanıtı.
   - İşleme başarısız olursa "OK" dönülmez; sağlayıcı yeniden dener. İşlenmiş bir olay tekrar gelirse yalnızca "OK" döner.
   - Bizim oturumumuza ait olmayan `merchant_oid`'e "OK" dönülmez; loglanır. Hesap paylaşılırken (canlı hesabın test penceresi) başkasının bildirimi böylece PayTR'de bekler ve adres geri alınınca sahibine gidebilir.
6. **Sahipsiz ödeme otomatik iade edilir.**
   - Sahipsiz ödeme: para çekilmiş ama sipariş açılamamış ödeme.
   - Olası nedenler:
     - Sepet ödeme sırasında değiştiği için oturum silinmiş.
     - Sepet başka bir oturumla tamamlanmış.
     - Stok tükenmiş.
     - Tutar uyuşmuyor.
   - Böyle bir ödeme sağlayıcıda iade edilir, denetim kaydına ve panel uyarısına düşer.
7. **Uzlaştırma işi.**
   - Bildirimi gelmeyen açık oturumlar, zamanlanmış bir işle sağlayıcıdan sorgulanır.
   - F2 S6'daki `outcome_unknown` kuralı geçerli: yeniden denemeden önce durum sorgusu yapılır.
8. **İade tutarını bizim workflow'umuz hesaplar.**
   - `POST /admin/orders/:id/refunds` iade edilecek kalemleri alır.
   - Sipariş kilidi altında tutar ve satır defteri F4.7'nin `lib/orders/refunds`'u ile hesaplanır. Ardından Medusa'nın `refundPaymentWorkflow`'u bu tutarla çağrılır.
   - Sağlayıcı yalnızca tutarı iade eder. PayTR iadesi tutar bazlıdır; iyzico tutarı kalem işlemlerine dağıtır.
9. **Geri ödeme bir kez yapılır.**
   - Sağlayıcı iptal ve iadeleri `payment.data`'da tutar; her çıktısı verinin tamamıdır.
   - Aynı `context.idempotency_key` ile sağlayıcıya ikinci kez gidilmez. PayTR'de sonuç belirsizse `reference_no` durum sorgusunda aranır.
   - PayTR'de iptal API'si yok; `cancelPayment` tam iade yapar.
   - Test modunda (paneldeki test modu, ADR-0027) yalnızca durum sorgusunda `test_mode=1` görünen işlem iade edilebilir. Test modu canlı anahtarla çalıştığı için bu kural, bir hatanın ya da sızıntının hesabın gerçek ödemelerini iade etmesini engeller.
   - `deletePayment` hiçbir durumda hata fırlatmaz.
10. **Dönüş adresleri sınırlıdır.**
    - Storefront'un verdiği dönüş adresinin origin'i `STORE_CORS` listesinde olmalı; yol göreli ve güvenli olmalı. Aksi halde 400 döner.
    - Kullanıcı bilgisi içeren, protokolü göreli (`//`) ya da backslash'li adresler reddedilir.
11. **Kayıtlı kart kapsam dışıdır.**
    - PayTR'de kart saklama yalnızca Direkt API'de var. iyzico'da kartı satıcının kaydetmesi için kart numarası gerekiyor.
    - İki yol da kart verisini bizim tarafımıza getirir ve SAQ-A'yı bozar. iyzico Checkout Form'un müşteri cüzdanı (kart iyzico'da, bize anahtar gelmez) iyzico görevinde değerlendirilir.

## Alternatifler

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **Kendi oturum ve bildirim uçlarımız (seçilen)** | Sepet ve tutar sunucuda; imza doğrulanmadan iş yapılmıyor; "OK" yalnızca sipariş açıldıktan sonra; sağlayıcının yeniden denemesi kalıcı kuyruk işi görüyor | İki uç ve bir modül daha; Medusa'nın hazır akışından sapma |
| Medusa'nın çekirdek uçları (`payment-sessions` + `/hooks/payment/:provider`) | Az kod | İstemcinin `data`'sı sağlayıcıya gidiyor; bildirim doğrulanmadan 200; olay kaybolursa (yerel olay yolu, yeniden başlatma) ödeme siparişsiz kalıyor; idempotency yok |
| Sağlayıcı yalnızca kayıt tutar, PayTR'yi workflow adımı çağırır | Sepete erişim kolay | Sağlayıcı soyutlaması delinir; F6 yönlendiricisi ve sözleşme testleri sağlayıcı arayüzüne dayanıyor |
| Alıcı bilgisini `context`'te taşımak | `data`'dan ayrı durur | `context` kalıcı ve muhtemelen Store yanıtında; tip dışı alan |

## Sonuçlar

- **Ortak modül.** Yeni `webhook-events` modülünü iyzico ve F7'deki Geliver de kullanır.
- **Form gövdesi.** `lib/clients` form-encoded gövde desteği kazanır (PayTR).
- **Dev'de bildirim.** Bildirim için dev'de herkese açık bir adres (tünel) gerekir. PayTR hesabının bildirim adresi tek olduğundan, canlı satış yapan bir hesapla uçtan uca test edilemez (docs/12).
- **İstemci IP'si.** `user_ip` istemcinin gerçek IP'si olmalı; değilse PayTR token'ı geçersiz olur. F16'daki proxy şartı (`trust proxy`) ödeme için de geçerli.
- **Ters ibraz.** PayTR ters ibraz bildirimi sunmuyor; F6.7 PayTR için elle kayıtla çalışır.
- **Medusa 2.22 yükseltmesi.** Bu ADR'nin dayandığı davranışlar yükseltmede yeniden doğrulanır: oturum verisi, tamamlama kilidi, telafi sırası.

## Uygulama notu (F5 kapanışı, 2026-10-27)

Karar uygulandı; uygularken öğrenilenler ve kararın genişledikleri:

- **Başlatma:** tek giriş `POST /store/carts/:id/payment-session` (`startCartPaymentWorkflow`, sepet kilidi altında). Medusa'nın kendi oturum ucu vitrine kapalı. Sepet tamamlama yalnızca canlı, tutarı tutan bir barındırılan form oturumuyla (`requireHostedPayment`, `paymentMismatch`).
- **Sonuç:** PayTR sunucudan sunucuya bildirim gönderiyor (`/hooks/paytr`, olay kaydıyla tek işlenir). iyzico'nun sonucu alıcının tarayıcısıyla gelir (`/hooks/iyzico/callback`, mağazanın gizli anahtarıyla imzalı adres). İkisinde de sonuç her zaman sağlayıcıya sorulur ve imzası doğrulanır.
- **Uzlaştırma:** iki sağlayıcının da işi var (`paytr-reconcile`, `iyzico-reconcile`). iyzico'da Medusa'nın sildiği oturumların formları da sorulabilsin diye verilen her form `payment-forms` modülüne yazılır.
- **Sahipsiz ödeme:** `payment-recovery`'ye bir kez yazılır, kurtarma işi iade eder. PayTR referansla tekilleştirir. iyzico tekilleştirmez: iptal, olmazsa kalem kalem iade; kısmi başarıda mağazaya bırakılır. Kayıtlı bir ödeme bir daha asla siparişe dönüşmez (güvenlik incelemesi).
- **İade:** satır bazlı defter (`order-refunds`), referans başına bir kez. PayTR referansla tekilleştirir. iyzico'ya gidecek her parça önce deftere `sending` yazılır, kayıp yanıtta tekrar gönderilmez.
- **Medusa 2.21.2 bulguları:**
  - `cancelOrderWorkflow` iade hatasını yutuyor; iptalden önce kendi iademiz çalışır.
  - Her iade denemesine yeni anahtar veriliyor; referansı biz sabitledik (`pending_refund`).
  - Değiştirilen oturum kalıcı siliniyor.
  - Query iç içe `raw_` değerlerini yalnızca düz alan da istenince dolduruyor.
- **Sözleşme testleri:** `src/modules/__tests__/payment-providers.contract.unit.spec.ts` iki barındırılan form sağlayıcısını aynı senaryolardan geçirir (çevrim dışı havale ve kapıda ödeme `offline-providers.contract.unit.spec.ts`'te, F6 W4): yalnızca kendi ucumuzdan başlama, kişisel verisiz oturum, kuruş tutar, ödenince `captured`, değişmeyen/geri alınmayan oturum, referanssız iadenin reddi. F6.4 genişletir.
- **Ertelenenler (kullanıcı kararı):** gerçek sağlayıcı testleri (PayTR test penceresi, `@sandbox`) sunucuya çıkışa; iyzico webhook'u gerçek firmaya. Bir iyzico sandbox ödemesi elle, deneme sayfasından yapıldı (ADR-0028).

## Ek (2026-11-06): Ödenen sepet her zaman siparişe döner

**Olay (dev).** Kartla ödeme alındı, PayTR bildirimi geldi; `completeCartWorkflow` "Not enough stock available for item … at location …" ile düştü (son adet bekleyen başka bir siparişin, #696, rezervasyonundaydı). `completionWillFailAgain` yalnızca `inventory` kelimesini arıyordu; Medusa'nın mesajında bu kelime yok (`iitem_…`). Hata yeniden denenebilir sayıldı: PayTR'ye 503, sonsuz yeniden deneme; alıcı "Ödemeniz onaylanıyor" sayfasında kaldı, para alınmıştı. Aynı yarış, son adede iki alıcı ödediğinde de olur.

**Karar.** "Engel değil uyarı" kuralıyla (sert engel yalnız sağlayıcı/yasa reddi, para, güvenlik; burada para zaten alınmış): **ödenen sepet her zaman siparişe döner.**

1. **Sınıflandırma** (`lib/payments/completion.ts`, birim testli):
   - `stock`: Medusa'nın stok retleri, kendi sözcükleriyle (`Not enough stock available…`, `Item … is not stocked at location …`, `Sales channel … is not associated with any stock location…`, `Some variant does not have the required inventory`).
   - `refund`: sepetin kendi kuralları (`cart.`, `payments.`, `promotions.`, `cash_on_delivery.`, `bank_transfer.`, `legal.`, `age.`, `fraud.`, `gift_card.` anahtarları). Bunlar §6'nın iade yoluna gider.
   - `retry`: geri kalan her şey (kilit, veritabanı, sağlayıcı, bilinmeyen): 503, sağlayıcı yeniden dener. Para yalnızca sipariş kesin açılamayacaksa iade edilir.
2. **Stok yetersizse eksik stokla sipariş** (`completePaidCartAsBackorderWorkflow`). Medusa 2.21.2'de tamamlama yalnızca rezervasyonda stok bakar. `prepareConfirmInventoryInput`, varyantın `allow_backorder`'ını sepet sorgusundan okur (`completeCartFields`: `items.variant.allow_backorder`). `reserveInventoryStep` bunu `createReservationItems`'a geçirir; envanter modülünün `ensureInventoryLevels`'ı `allow_backorder` kalemlerde stok kontrolünü atlar (core-flows ve inventory kaynağı, v2.21.2 etiketi). `completeCartWorkflow`'un girdisi yalnızca `id`, kalem düzeyinde `allow_backorder` geçirilemiyor. Bu yüzden iş akışı şunları yapar:
   1. Mağaza genelinde tek kilit alır (`payments-complete-backorder`).
   2. Sepetin izlenen varyantlarına tamamlama süresince `allow_backorder: true` verir. Telafisi geri alır.
   3. Kanalın depolarında hiç seviyesi olmayan kalemlere 0 seviye açar (`createInventoryLevelsWorkflow`, kendi telafisiyle).
   4. `completeCartWorkflow.runAsStep` çalıştırır.
   5. Varyantları geri alır. Bu adım hata vermez, yalnızca loglar; sipariş durur.
   6. Siparişi `metadata.stock_short` ile işaretler: `{ lines: [{ variant_id, title, sku, quantity, short }], at }`.
   7. `order.stock_short` yayar.

   Rezervasyon raf üstü yapılır (rezerve > stok). Kargo eksik rezervasyonu zaten doldurur (adr/0054 Ek 2026-11-05).
3. **Mağazaya bildirim** (`subscribers/stock-short-alerts.ts`). Zil sipariş başına bir kez gelir: "Stok yetersiz sipariş #N — eksik: … Üretin ya da tedarik edin; edemeyecekseniz iptal edip iade edin". E-posta `staff.stock_short` şablonuyla gider. Ayrı bir ayar açılmadı: Ayarlar > Bildirimler'deki "Yeni sipariş" anahtarına bağlı. Panelde liste ve detayda "Stok yetersiz" rozeti, detayda eksik satırlar görünür. Bunlar sipariş gönderilecek durumdayken (`awaiting_payment`, `to_ship`) gösterilir.
4. **Bekleme sayfası hiç sonsuz dönmez.** `/odeme/sonuc` artan aralıklarla yaklaşık 2 dakika sorar (2, 2, 3, 3, 4, 5, 6, 8, 10, 12, 15, 15, 15, 20 sn). Sonra şu durumlardan birini gösterir:
   - Sipariş açıldıysa sipariş sayfası.
   - İade ediliyorsa "iade" sayfası, sepete ve iletişime bağlantıyla.
   - Hâlâ belirsizse "Ödemeniz alındı, siparişiniz oluşturuluyor": e-postayla bilgi verilir, "Siparişimi bul" (`/siparis`) bağlantısı vardır.

   `POST /store/carts/:id/order-access` sipariş yokken, bu sepet için `completion_failed` ya da `amount_mismatch` kurtarma kaydı varsa 409 `payments.refunding` döner. Yoksa eskisi gibi 404 `orders.unknown`.
5. **Önleme.** Medusa'nın sepete ekleme kontrolü (`confirmInventoryStep` → `confirmInventory`) zaten satılabilir adede bakar (stok − rezerve). Ödemeden önce bakan bir kontrol yoktu. İki kontrol eklendi:
   - **Ödeme başlarken:** sepet kilidi altında, sağlayıcı token'ından hemen önce (`checkCartStockStep`, `startCartPaymentWorkflow`). Stok yetersizse 400 `cart.out_of_stock` döner, değerinde ürün adı vardır.
   - **Ödeme adımına girerken:** vitrin `GET /store/carts/:id/stock`'u sorar. Eksik satır varsa alıcı `/sepet?hata=cart.out_of_stock` sayfasına gider ve sepet "Bu ürün az önce tükendi: …" der.

   İkisi de `getVariantAvailability`'yi kullanır. Stok izlemeyen ya da eksi stokla satan varyant hiç durdurulmaz.

**Bilinen sınır.** Varyantlar birkaç saniye eksi stokla satışa açık kalır. Bu sürede aynı varyanta başka bir tamamlama (havale, kapıda ödeme) da stok kontrolsüz geçebilir ve işaretsiz kalır. Kilit yalnızca ödenmiş eksik stok tamamlamalarını sıraya koyar. Kabul edildi: pencere kısa, sonuç zaten kabul ettiğimiz durumla aynı (rezerve > stok, kargo doldurur). Medusa kalem düzeyinde `allow_backorder` geçirmeye izin verirse (yükseltmede bakılır), bu açma/kapama kaldırılır.
