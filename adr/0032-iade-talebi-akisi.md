# ADR-0032: İade talebi (RMA) akışı

- **Durum:** Kabul edildi (2026-10-28 sabaha karşı, otonom çalışma; kullanıcı 2026-10-28 öğlen onayladı).
- **Tarih:** 2026-10-28
- **İlgili:** F7.9 (iade talebi), F7.11 (değişim, bu akışın üstüne kurulur), ADR-0031 (kargo), F5 V5 (kalem bazlı iade), F8 (iade faturası), F13 (cayma hakkı metinleri)

## Bağlam

F7.9 iade talebini uçtan uca istiyor:
1. Müşteri talep açar, neden kodunu seçer.
2. Mağaza onaylar ya da reddeder.
3. Onaylanınca müşteriye iade kodu verilir.
4. Ürün depoya varınca kontrol edilir.
5. Para iadesi yapılır, stok geri girer, iade faturası kesilir.

Medusa v2'nin iade modeli (Kaynak: core-flows v2.21.2) şöyle çalışıyor:
- İade sipariş değişikliği olarak açılır, kalemler istenir ve onaylanır. Bunlar ayrı iş akışları: `beginReturnOrderWorkflow`, `requestItemReturnWorkflow`, `confirmReturnRequestWorkflow`.
- Teslim alma da aynı şekilde aşamalıdır: `beginReceiveReturnWorkflow`, `receiveItemReturnRequestWorkflow`, `confirmReturnReceiveWorkflow`. Onayda stok iadenin deposuna geri girer.
- Medusa'da "talep edildi, mağaza değerlendiriyor" durumu yoktur: iade açılınca istenmiş sayılır.
- Para iadesi yapmaz; yalnızca siparişin ödeme toplamını günceller.
- Tek adımlı `createAndCompleteReturnOrderWorkflow` "şimdi teslim al" seçildiğinde istenen kalemleri değil siparişin bütün kalemlerini teslim alır. Kısmi iade için uygun değil.

## Karar

1. **`return-requests` modülü.** Müşterinin talebi Medusa'dan ayrı kaydedilir:
   - sipariş, müşteri, kalemler ve adetler, neden kodu, müşteri notu;
   - durum: `requested` → `approved` | `rejected` → `received` → `refunded`, ayrıca `canceled`;
   - karar notu, kararı veren ve zaman;
   - Medusa iadesinin kimliği, iade kodu ve takip numarası, iade tutarı ve referansı.
   - Bir siparişte aynı anda tek açık talep olur (kısmi tekil indeks).
   - Kişisel veri yok: adres ve ad siparişte.
2. **Neden kodları sabit liste:** hasarlı geldi, yanlış ürün, tarif edildiği gibi değil, fikrim değişti, beden/ölçü uymadı, diğer. Metinleri storefront ve panelde i18n.
3. **Talep kuralları (Store, oturum açmış müşteri, kendi siparişi):**
   - Yalnızca teslim edilmiş ya da kargodaki kalemler, gönderilenden önceki talepler ve iade penceresinden parası geri verilmiş birimler düşülerek iade edilebilir.
   - Süre son teslimden itibaren 14 gündür (mesafeli satış cayma süresi). Teslim edildi işaretlenmeyen koli çıkışından 30 gün sonra teslim edilmiş sayılır; süre böylece sonsuza kadar açık kalmaz. Mağazaya özel süre ve istisnalar F13'te ayara bağlanır.
   - Daha önce istenenler düşülürken talep sayısı ile Medusa'nın o kalemdeki iade sayılarından büyüğü alınır.
   - Sipariş kilidi altında çalışır, aynı anda tek talep açılır.
4. **Onay (panel, personel):**
   - Medusa iadesi aşamalı iş akışlarıyla açılır ve onaylanır, kargo yöntemi olmadan: Medusa iade gönderisini kendisi açmaz.
   - Sipariş Geliver'le gittiyse iade gönderisi Geliver'de açılır (`POST /shipments/:id { isReturn }`). İade, istenen kalemlerin en çoğunu taşımış koliye açılır (çok kolili sipariş). Barkod ya da takip numarası müşteriye iade kodu olarak verilir; etiket özel depoya yazılır.
   - Mağaza kendi gönderdiyse iade kodu olmadan onaylanır. Doğrudan taşıyıcı (F7.14) gelince onun iade kodu kullanılır.
   - Ret bir notla kapanır.
5. **Depoya varış (panel):**
   - Personel her kalem için sağlam ve hasarlı gelen adedi ayrı girer; eksik gelen düşülür.
   - Medusa teslim alma iş akışları çalışır: sağlamlar stoğa döner, hasarlılar Medusa'nın "dismiss" yoluyla sayılır ama stoğa dönmez.
   - Para iadesi kendi iade akışımızla kalem bazında, sağlam ve hasarlı adetlerin toplamı için yapılır (F4.7 payları, sağlayıcı kuralları, `return<talep>` referansıyla bir kez).
   - Kargo ücreti varsayılan olarak iade edilmez. Teslim almada personel "kargo ücretini de iade et"i seçer; panel bunu hasarlı, yanlış ve tarif edildiği gibi olmayan üründe işaretli önerir. Müşterinin seçtiği neden tutarı tek başına belirlemez (kural 5).
   - `return.refunded` olayı talep "refunded"a geçerken bir kez yayınlanır. İade faturası F8'de bu olaya bağlanır.
   - Onay, teslim alma ve para iadesi siparişin iade kilidi altında talebi yeniden okur; durum yazımı beklenen durumdan yapılır. İki tıklama ikinci Medusa iadesi ya da ikinci para iadesi açmaz.
6. **Değişim (F7.11)** bu akışın üstüne kurulur (ek, 2026-10-28; Medusa v2.21.2 exchange iş akışları kaynaktan doğrulandı):
   - Talebin türü `exchange` olur ve iade edilen her ürün için aynı ürünün başka varyantı (beden, renk) aynı adetle istenir.
   - **Onayda** Medusa'nın değişimi açılır:
     - iade edilecek kalemler istenir;
     - yeni kalemler Medusa'nın güncel fiyatıyla eklenir;
     - yeni kalemler için siparişin kargo seçeneğiyle ücretsiz bir giden kargo yöntemi eklenir, böylece stokları ayrılır;
     - değişim onaylanır, iade gönderisi iadedeki gibi açılır.
   - **Fark tutarı** sunucuda hesaplanır: yeni varyantın bugünkü fiyatı (Medusa'nın siparişe yeni satır eklerken kullandığı fiyat: para birimi, bölge, müşteri, fiyat listeleri) eksi satırın satın alındığı birim fiyat, adetle çarpılır. Medusa da iade edilen birimi birim fiyatından sayar; aynı fiyatlı beden değişimi kuponlu siparişte de 0 tutar.
     - Talep açılırken fark hesaplanıp saklanır; personel onaylarken yeniden hesaplanır. Değiştiyse yeni değer saklanır ve onay `returns.exchange_price_changed` ile reddedilir, personel yeni farkı görüp tekrar onaylar.
     - Onaydan sonra Medusa'nın toplamlarıyla karşılaştırılır. Medusa yeni kalemi borca hemen ekler, iade edilen kalemi ise teslim alınınca düşer. Bu yüzden fark, borç artışı eksi iade edilen satırların birim fiyatıdır; uyuşmazsa onay geri alınır.
     - Müşteri borçluysa onay, personel "farkı müşteriden aldım" demeden yapılmaz (`returns.exchange_difference_due`). Onayda Medusa'nın açtığı tahsilat ödendi işaretlenir (`markPaymentCollectionAsPaid`, sistem sağlayıcısı). Çevrim içi tahsilat bağlantısı bildirimler ve storefront'la gelir (F9/F18).
     - Mağaza borçluysa fark, teslim almada kendi iade akışımızla geri verilir (`return<talep>` referansıyla). Bu iade hiçbir kaleme yazılmaz; kalemler farkı zaten gösterir, sonraki kalem iadeleri eksik kalmaz. Kargo ücreti iade edilmez; yeni gönderinin kargosu mağazadan (0 TL giden yöntem).
     - İndirimle alınmış satır yalnızca aynı fiyatlı seçenekle değiştirilir (`returns.exchange_discounted_price`). Medusa iki tarafı da liste fiyatından sayar; farklı fiyatta indirim yok sayılırdı (güvenlik incelemesi 2026-10-28).
     - Medusa'nın açtığı tahsilat değişimin farkından büyükse (siparişte başka bir açık bakiye varsa) onay reddedilir (`returns.exchange_balance_open`).
   - **Teslim almada** istenen bütün birimler (sağlam ya da hasarlı) gelmelidir (`returns.exchange_incomplete`); eksik gelen birim için yeni ürün gönderilmez. İade edilen kalemler stoğa döner (hasarlı olan dönmez). Yeni kalemler siparişin "Kargoya ver"iyle gider. Değişimin iadesi teslim alınmadan sipariş kargoya verilmez (`returns.exchange_awaiting_return`); "hemen gönder" mağaza ayarı F13'e kalır.
   - Bir adım başarısız olursa Medusa'nın değişimi de geri alınır: ayrılan stok bırakılır, talep yeniden onaylanabilir (test edildi).
   - Değişim faturası (iade + yeni satış) F8.5'te talebin durumuna bağlanır.
7. **Medusa'nın kendi iade, değişim ve talep (claim) rotaları kapalıdır** (güvenlik incelemesi 2026-10-28):
   - `/store/returns` sipariş kimliğini bilen herkese iade açtığı için 404 döner.
   - `/admin/returns`, `/admin/exchanges`, `/admin/claims` altındaki değişiklikler reddedilir (okumalar denetimli kalır). Akışlarımız Medusa iş akışlarını doğrudan çağırır, bu rotaları kullanmaz.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Kendi talep kaydı + Medusa'nın aşamalı iadesi (seçilen)** | Onay/ret adımı, neden kodu, iade kodu ve para iadesi bizim kurallarımızla; stok Medusa'nın kendi akışıyla | İki kayıt (talep ve Medusa iadesi) birlikte tutulur |
| Yalnızca Medusa iadesi | Tek kayıt | Talep/onay yok; müşteri talebi doğrudan iade olur, ret için iptal gerekir |
| `createAndCompleteReturnOrderWorkflow` | Tek çağrı | Teslim almada bütün kalemleri alıyor (kısmi iade bozulur) |

## Sonuçlar

- İade faturası (F8), muhasebe kaydı (F11) ve müşteri bildirimleri (F9) `return.refunded` ve durum değişikliklerine bağlanır.
- Cayma süresi, iade edilemeyen ürün türleri (hijyen, kişiye özel) ve iade kargo ücretini kimin ödediği F13'te mağaza ayarı olur.

## Ek (2026-11-03): Mesafeli Sözleşmeler Yönetmeliği 2026 uyumu

**Dayanak:** Mesafeli Sözleşmeler Yönetmeliği ("MSY"; RG 27.11.2014/29188). 23.8.2022/31932 ve 24.5.2025/32909 değişiklikleriyle 1.1.2026'dan beri yürürlükte. Maddeler mevzuat.gov.tr'deki işlenmiş metinden (MevzuatNo 20237) 2026-11-03'te kontrol edildi:

- md. 12/1: satıcı, malın iade için ön bilgilendirmede belirtilen taşıyıcıya teslim edildiği tarihten itibaren 14 gün içinde, teslim masrafları dahil tahsil ettiği bütün ödemeleri iade eder. Mal başka taşıyıcıyla gönderildiyse süre malın satıcıya ulaştığı tarihten başlar.
- md. 12/5 (32909 ile, 1.1.2026): satıcının belirttiği taşıyıcıyla yapılan iadede tüketiciden iade masrafı istenemez. Taşıyıcı belirtilmediyse de istenemez. Taşıyıcının tüketicinin bulunduğu yerde şubesi yoksa satıcı malı ek masraf istemeden alır.
- md. 13/3 (tüketicinin iade masrafını üstlenmesi) 32909 ile yürürlükten kalktı.
- md. 15/1-b kişiye özel hazırlanan mal; 15/1-ç koruyucu ambalajı açılmış, iadesi sağlık ve hijyen açısından uygun olmayan mal; 15/1-ğ elektronik ortamda anında ifa edilen hizmet ve anında teslim edilen gayrimaddi mal; 15/1-h tüketicinin onayıyla süre bitmeden ifasına başlanan hizmet.

**Karar:**

1. **Gidiş kargo ücreti (md. 12/1).** §5'teki "kargo ücreti varsayılan olarak iade edilmez" kuralı kalktı.
   - Cayma hakkı içindeki bir kalemi kapsayan her iadede (`kind: "return"`) siparişin kargo ücreti para iadesine girer. Personelin "kargo ücretini de iade et" kutusu bu iadelerde dikkate alınmaz.
   - Müşterinin seçtiği neden fark etmez: caymada gerekçe gerekmez, "hasarlı geldi" demek cayma hakkını daraltmaz.
   - **Kısmi iade:** siparişin bir kısmı dönse de kargo ücretinin tamamı ilk iadeyle verilir. Yasal varsayılan budur; avukat aksini söylerse mağaza ayarı olur (docs/12). Mağaza ayarı yoktu, eklenmedi.
   - Kargo ücreti bir kez verilir. `refund_shipping` yalnız onu veren talepte `true` olur; sonraki talepte `false`. İade belgesi (gider pusulası) de buna göre kargoyu bir kez yazar.
   - Yalnız cayma dışı satırları kapsayan, kusurlu, yanlış ya da açıklamaya uymayan diye gelen iadede kargo ücreti personelin kararıdır (TKHK md. 11; panel işaretli önerir).
   - Değişim (§6) ve hediye kartı caymasında (adr/0025) kargo iadesi yok; değişmedi.
   - Kod: `lib/orders/withdrawal-rules.ts` (`shippingRefundDue`), `workflows/returns/steps/receipt.ts`, `receive-return.ts`.
2. **İade kargo ücreti (md. 12/5, md. 13/3 mülga).** Ayarlardaki "İade kargosunu ödeyen: Müşteri" seçeneği kaldırıldı.
   - Cayma iadesinde müşteriden masraf istenemez. Ayıplı malda masraf zaten satıcınındır (TKHK md. 11). Değişim yasal bir hak değildir ve iade kodu yine mağazanın hesabından açılır. Seçeneğin yasal kalacağı bir iade türü yok; "yalnız cayma dışı iadeler için" diye daraltmak da işlevsiz bir ayar bırakırdı.
   - `returns.return_shipping` yalnız `"shop"` alır; `"customer"` 400 `platform_settings.return_shipping_shop_only` döner.
   - Kayıtlı `"customer"` değeri `migration-scripts/returns-shipping-shop.ts` ile `"shop"` olur. Değişiklik denetim kaydına sistem olarak düşer.
   - Alan, panel denetimi kaldırana kadar durur. JSON-LD `returnFees` hep `FreeReturn`.
3. **Para iadesinin süresi (md. 12/1).** Para depoya varışta iade edilmeye devam eder; süre izlenir.
   - Talebe `handed_over_at` eklendi. Kargo takip işi (`shipment-tracking`, 30 dakikada bir) onaylanmış ve iade gönderisi olan talebin gönderisini Geliver'e sorar. Taşıyıcı aldığında (`picked_up`…`delivered` ya da `returned`) ilk görüldüğü an yazılır.
   - Bir okuma kaçarsa tarih gerçek alımdan biraz sonra olabilir; 10. gündeki uyarı 4 günlük pay bırakır.
   - Bugün yalnız Geliver iade gönderisi açıyor (§4). Mağaza kendi gönderdiyse ya da tarih bilinmiyorsa süre depoya varıştan (`received_at`) sayılır; bu, md. 12/1'in "başka taşıyıcı" kuralıdır.
   - Yönetici yanıtında `handed_over_at` ve `refund_due_at` (teslim ya da varış + 14 gün) var.
   - `return-refund-deadlines` işi saatte bir çalışır. 10. gün geçmiş ve parası verilmemiş her iade için personelin ziline bir kez `returns.refund_deadline_near` düşer (`refund_alerted_at`). Kargo yolda olsa da düşer: süre teslimden işler.
   - Geliver'in bildirimi iade gönderisini henüz tetiklemez; iş yakalar.
4. **Hijyen istisnası (md. 15/1-ç) ve ürün işareti** (adr/0052 Ek ile):
   - Fiziksel ürünün ürün düzeyindeki işareti talebi artık engellemez. Satır cayma hakkı içinde kalır ve mağaza ile panelde `withdrawal_warning: "sealed_goods"` taşır. Vitrin formu bu satırda "koruyucu ambalajı açılmış ürün iade alınmaz" uyarısını göstermeli (vitrin işi).
   - Teslim almada personel ambalajı açılmış birimleri `refused` listesine yazar. Yalnız `sealed_goods` satırı reddedilebilir; başka satır `returns.refusal_not_sealed` alır.
   - Reddedilen birim Medusa'nın teslim alma akışına girmez, stoğa dönmez, para iadesine girmez ve yeniden istenemez. Talepte `refused_items` (`reason: "unsealed"`) olarak kalır; müşteri kendi talebinde görür. Ürün müşteriye geri gönderilir.
   - Yalnız reddedilen birim geldiyse talep "received" kalır, para iadesi yapılmaz, zil çalmaz.
   - Müşteri reddedilen birimleri `return.refused` e-postasıyla öğrenir (`return_request.refused` olayı, teslim almada birim reddedildiyse). E-posta birimleri ve nedenini ("koruyucu ambalajı açılmış") yazar, bedelin iade edilmeyeceğini ve ürünün ücreti mağazaya ait olmak üzere geri gönderilebileceğini ya da teslim alınabileceğini söyler. Her şey reddedildiyse giden tek ileti budur. Kısmi retten sonra `return.refunded` reddedilenlerin tutara dahil olmadığını yazar. İade iletileri yalnız e-postadır; geri gönderim ücretinin kime ait olduğu avukata açık sorudur.
   - Dijital ve hizmet ürünündeki işaret kesin istisnadır (md. 15/1-ğ, h): `withdrawal_excluded_reason: "product"`.
   - Vitrin, ürün sayfasında işareti siparişten önce göstermek için (md. 5/1-h, md. 6/2) Store API ürün okumasında `fields=+product_extension.withdrawal_excluded,+product_extension.kind` ister; ikisi yalnız ürünün kendi yanıtında açıktır, bir ilişki üzerinden (`items.product.…`) istenemez.

**Açık (avukata, docs/12):**

- kısmi iadede kargo ücreti;
- kapıda ödeme ücretinin "tahsil edilen tüm ödemeler"e girip girmediği (md. 12/1). Bugün iade edilmiyor;
- reddedilen ürünün müşteriye geri gönderim ücreti;
- değer kaybı kesintisi (md. 13/2). Platformda yok;
- iade için öngörülen taşıyıcının adı (md. 5/1-g). Ayarlarda yok.
