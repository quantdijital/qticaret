# ADR-0041: Yasal metinler, onay kayıtları, kısıtlı ürünler ve KVKK talepleri

- **Durum:** Kabul edildi (önerildi 2026-10-30, otonom uygulandı; kullanıcı 2026-10-30 bütün otonom kararları kabul etti)
- **Tarih:** 2026-10-30
- **İlgili:** F13; ADR-0003 (KVKK ve yurt dışı aktarım), ADR-0009 (TCKN şifreleme, kalıcı silme açık), ADR-0011 (denetim kaydı saklama), ADR-0019 (içerik belgesi), ADR-0030 (ters ibraz kanıtı), ADR-0032 (cayma süresi ve istisnalar), ADR-0036 (`legal-consent` F13'te), ADR-0038 §2 ve §4 (ödeme ve çerez onayı), docs/12 (avukat, KVKK danışmanı), docs/13 (JSON-LD), docs/04 (ihlal bildirimi)

## Bağlam

Bugün mağazanın hiçbir yasal metni yok. Ödemede yalnızca ticari ileti izni alınıyor (`messaging` `checkout_consent`). Sözleşme onayı, metnin kopyası ve IP kaydı tutulmuyor. Ters ibraz kanıt paketinde bu bölüm "F13'te" diye boş duruyor (ADR-0030).

Diğer eksikler:

- Cayma süresi koda 14 gün olarak sabitlenmiş (`lib/orders/returns.ts`).
- Mağaza künyesi yok (`platform-settings` `store` yalnızca iletişim bilgisi tutuyor). SEO kurulum listesinin "künye" maddesi bu yüzden kapanamıyor.
- Çerez onayı sepete bağlı. Sepeti olmayan ziyaretçinin onayı kaydedilemiyor; "zorunlu" kategorisi ve metin sürümü de yok.
- Kişisel veri dışa aktarma, silme ve anonimleştirme akışı yok. Saklama işleri yalnızca bazı tablolar için var.

Medusa 2.21.2'de doğrulananlar (Context7 `/medusajs/medusa`, v2.21.2 kaynağı):

- **Sepet tamamlama:** `completeCartWorkflow.hooks.validate` kilitten ve kalem/ödeme denetiminden sonra, sipariş oluşmadan ve ödeme yetkisinden önce çalışır. Atılan hata tamamlamayı durdurur.
  - Medusa kanca başına tek işleyici kabul eder. Bizim işleyicimiz `workflows/hooks/complete-cart-validate.ts`; yeni denetimler oraya eklenir.
  - Ödemesi alınmış sepeti tamamlayan yol (`complete-paid-cart.ts`) da aynı kancayı çalıştırır. Oradaki `completionWillFailAgain` yalnızca bilinen öneklerdeki hataları kalıcı sayar; yeni bir önek eklenmezse hata yeniden denenir ve para iade edilmez.
  - `orderCreated` kancası çalışma anında var ama belgelenmemiş (`@ignore`); kullanılmaz.
- **Sepet `metadata`'sı:** Vitrinden yazılabilir, bu yüzden onay kanıtı olamaz.
- **Müşteri silme:** `deleteCustomersWorkflow` müşteriyi yalnızca yumuşak siler; kişisel veri satırda kalır. `removeCustomerAccountWorkflow` giriş kaydını da kaldırır. Siparişler müşteriden bağımsızdır, kendi e-posta ve adreslerini tutar.
- **Sipariş güncelleme:** `updateOrderWorkflow` eski e-posta ve adresi sipariş değişiklik geçmişine (`order_change` `details.old`) yazar. Sipariş modülünün `updateOrderAddresses` metodu geçmiş yazmaz.
- **Ziyaretçi kimliği:** Medusa'da sepet öncesi ziyaretçi kimliği yoktur.

## Karar

### 1. `legal` modülü: sürümlü yasal metinler (F13.1, F13.7)

- **`legal_document`:** tür, sürüm, durum (taslak/yayında/geride kaldı), şablon gövdesi, yayın zamanı, yayımlayan.
  - Türler: `distance_sales` (mesafeli satış), `pre_information` (ön bilgilendirme), `privacy_notice` (KVKK aydınlatma), `cookie_policy`, `return_policy`, `shipping_policy`, `membership` (üyelik).
- **Sürümler değişmez:** Yayımlanan sürüm değiştirilmez; düzenleme yeni bir taslak açar. Bir türün aynı anda tek yayında sürümü olur.
- **Şablon dili:** SEO şablonlarındaki gibi `{belirteç}`; kaydederken denetlenir (`lib/seo/template.ts` deseni).
  - Mağaza belirteçleri: `{mağaza_unvanı}`, `{mersis}`, `{vkn}`, `{adres}`, `{kep}`, `{iade_süresi}` vb.
  - Sipariş belirteçleri: `{alıcı_adı}`, `{teslimat_adresi}`, `{sipariş_kalemleri}`, `{toplam}`, `{ödeme_yöntemi}` vb.
  - Mağaza belirteçleri önizlemede ve vitrinde, sipariş belirteçleri yalnızca sipariş kopyasında doldurulur.
- **Gövde:** İçerik modülünün denetlenmiş belge yapısı (ADR-0019), HTML değil.
- **Şablon kütüphanesi (F13.7):** Her tür için başlangıç taslağı gelir, açıkça "avukat onayı gerekir" işaretiyle (docs/12). Yayımlarken panel bunu hatırlatır. Metinlerin hukuki doğruluğu platformun değil mağazanın ve avukatının sorumluluğudur.
- **Vitrin:** `GET /store/legal/:kind` yayındaki sürümü mağaza belirteçleri doldurulmuş döner.

### 2. Ödemede sözleşme onayı ve metnin kopyası (F13.2)

- **Kayıt:** Vitrin, gösterdiği sürümlerle `POST /store/carts/:id/legal-consents` çağırır (`distance_sales` ve `pre_information` zorunlu).
  - Kayıt `legal_consent` tablosuna sepete bağlı yazılır: sürümler, zaman, IP.
  - IP, ters ibraz kanıtı için gerektiğinden özetlenmez; `encryptPii` ile şifrelenir.
- **Denetim:** Doğrulama kancası, sepette yayındaki sürümlerin onayı yoksa `legal.consent_missing` ile tamamlamayı durdurur. Sürüm onaydan sonra değişmişse de durdurur.
  - `legal.` öneki `completionWillFailAgain` listesine eklenir.
  - Ödeme formu açılırken (barındırılan form, havale, kapıda ödeme) aynı denetim yapılır. Böylece onaysız sepetin ödemesi hiç alınmaz.
- **Kopya:** `order.placed` ile sepet kaydı siparişe geçer.
  - O anda sözleşme metni sipariş verileriyle doldurulur. Belge özeti (SHA-256) ile birlikte kalıcı ve değişmez bir kopya olarak saklanır.
  - Kopya kişisel veri içerdiği için şifrelidir (`encryptPii`).
- **Kullanıldığı yerler:**
  - Sipariş sayfası onay kaydını ve kopyayı gösterir; okuma kayıtlı okumadır.
  - Ters ibraz kanıt paketi kopyayı ve IP'yi içerir.
  - Müşteriye giden sipariş e-postası sözleşme bağlantısını taşır.

### 3. Mağaza künyesi ve politika alanları (F13.9, F13.1, F13.6)

- **`platform-settings` `legal` bölümü:** unvan, MERSİS no, VKN ve vergi dairesi, açık adres, KEP, ETBİS kayıt no, sosyal hesaplar (`sameAs`).
- **Eksik künye:**
  - Panelde uyarı çıkar (genel bakış ve Ayarlar).
  - SEO kurulum listesinin "künye ve politikalar" maddesi künye tam ve zorunlu metinler yayında olunca kapanır.
- **JSON-LD:** `OnlineStore` JSON-LD'sine adres, `sameAs`, `taxID` eklenir.
- **İade politikası:** `platform-settings` `returns` bölümü.
  - Cayma süresi: en az 14 gün, varsayılan 14.
  - İade kargo ücretini kim öder.
  - İade edilemeyen ürün türleri: ürüne `returnable: false` işareti (`catalog-extension`).
  - `windowOpen` süreyi buradan okur.
  - Bu alanlar ürün sayfasının `hasMerchantReturnPolicy` JSON-LD'sini besler. Kargo politikası mevcut `shipping` bölümünden gelir.

### 4. Yaş doğrulama ve kısıtlı ürünler (F13.3, F13.4)

- **Bayraklar:** `compliance.age_verification` ve `catalog.restricted`. Sektöre özel kod yazılmaz.
- **İşaret:** Ürüne ve kategoriye "kısıtlı" işareti konur (ürün `catalog-extension`'da, kategori için bağlantılı küçük bir tablo). Kategori işareti alt kategorilere ve ürünlerine geçer.
- **Ödemede:** Sepette kısıtlı ürün varsa ve bayrak açıksa yaş beyanı istenir (`POST /store/carts/:id/age-declaration`: doğum tarihi ve beyan kutusu).
  - Doğrulama kancası, mağazanın alt yaş sınırını (ayar, varsayılan 18) doldurmayan ya da beyanı olmayan sepeti `age.declaration_missing` / `age.under_limit` ile durdurur.
  - Doğum tarihi saklanmaz. Yalnızca "beyan edildi, sınırı geçiyor", zaman ve sınır değeri onay kaydına yazılır (veri en aza indirme).
  - Kimlik doğrulaması (e-Devlet vb.) bu fazda yok; gerekirse avukat görüşüyle sonraki faza.
- **SEO ve feed'ler:**
  - Kısıtlı ürünün `Product` JSON-LD'sine `hasAdultConsideration` eklenir; robots ayarı mağaza seçimine bırakılır (varsayılan index).
  - Feed'lerden varsayılan olarak çıkarılır (ADR-0038'deki karar burada uygulanır).

### 5. Çerez onayı (F13.8)

- **Ziyaretçi kimliği:** Vitrine kendi çerezimiz: rastgele, `HttpOnly`, `SameSite=Lax`, 13 ay.
- **Kayıt:** `POST /store/consents/cookies` ile kategoriler (`necessary` her zaman açık, `analytics`, `marketing`), çerez politikası sürümü ve zaman `cookie_consent` tablosuna yazılır. Ziyaretçi kimliği yalnızca özetiyle tutulur.
- **Sepet ve sipariş:** Sepet açılınca ziyaretçinin son onayı sepete, sipariş oluşunca siparişe geçer (mevcut `tracking_consent` bu kayda genişler). Dönüşüm olayları (F10.9) buradan okur.

### 6. KVKK talepleri ve saklama (F13.5)

- **`docs/kvkk-envanter.md`:** Hangi tablo hangi kişisel veriyi, hangi amaçla, ne kadar süre tutar; silmede ne olur.
- **Dışa aktarma:** Bir async iş (`customer.data_export`).
  - İçerik: müşterinin profili, adresleri, siparişleri, onay kayıtları, ileti geçmişi, iade talepleri; JSON ve okunur bir özet.
  - Dosya yalnızca isteyene ve sahibe; indirme kayıtlı okumadır.
- **Silme ve anonimleştirme (`anonymizeCustomerWorkflow`):**
  - Müşterinin adı, e-postası, telefonu sabit yer tutucularla değiştirilir.
  - Adresleri ve fatura profili kalıcı silinir (ADR-0009'daki açık iş).
  - Giriş kaydı kaldırılır (`removeCustomerAccountWorkflow` deseni).
  - Siparişlerin e-posta ve adresleri sipariş modülünün geçmiş yazmayan metodlarıyla yer tutucuya çevrilir; siparişin eski değişiklik geçmişindeki kişisel alanlar da temizlenir.
  - Tutarlar, kalemler, vergi, fatura ve muhasebe kayıtları korunur (yasal saklama; KK3).
  - İleti kayıtlarının adresleri, iç notlar, iade taleplerindeki serbest metinler ve onay kopyaları temizlenir. Onay kopyası yalnızca sözleşmenin yasal saklama süresi dolmuşsa temizlenir; yoksa kilitli tutulur (avukat görüşü).
  - Talep panelden personelce kaydedilir: kim, ne zaman, hangi kanaldan geldi, ne zaman tamamlandı. Vitrinden müşteri talebi F18'de.
- **Saklama işi (`compliance-retention`, gecelik):**
  - Denetim kaydının IP ve tarayıcı alanları 2 yıl sonra boşaltılır (ADR-0011).
  - Terk edilmiş sepetlerin onay kayıtları silinir.
  - Süreler `docs/kvkk-envanter.md`'de tek yerde ve KVKK danışmanı onaylayana kadar öneridir (docs/12).

### 7. Veri ihlali müdahale kılavuzu (F13.10)

- `docs/runbooks/veri-ihlali.md`: tespit, sınırlama, etki analizi, mağazaya bilgilendirme şablonu, KVKK Kurulu bildirimi (72 saat), ilgili kişi bildirimi, olay sonrası rapor; rol ve iletişim listesi.
- Masa başı tatbikat bir insanla yapılır; kaydı `docs/runbooks/tatbikatlar/` altına yazılır (KK5).

## Alternatifler

| Seçenek                                                         | Artı                                 | Eksi                                                                                 |
| --------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------ |
| Yasal metinleri içerik sayfası (`content`) olarak tutmak        | Hazır editör ve sayfa                | Sürüm ve değişmezlik yok; siparişe bağlanacak kesin sürüm olmaz                      |
| Onayı sepet `metadata`'sında tutmak                             | Sipariş oluşunca kendiliğinden geçer | Vitrinden yazılabilir; kanıt olamaz                                                  |
| Siparişin metin kopyasını saklamamak, sürüm numarasını saklamak | Az veri                              | Doldurulmuş metin (fiyat, adres) yeniden üretilemez; mevzuat kopyayı istiyor (F13.2) |
| Müşteriyi Medusa'nın silme akışıyla yalnızca yumuşak silmek     | Hazır                                | Kişisel veri satırda kalır; KVKK silme değildir                                      |
| `updateOrderWorkflow` ile anonimleştirmek                       | Belgelenmiş yol                      | Eski değerleri değişiklik geçmişine yazar; anonimleştirmeyi boşa çıkarır             |
| Doğum tarihini saklamak                                         | Sonradan kanıt                       | Veri en aza indirmeye aykırı; beyan ve sınır yeterli                                 |

## Sonuçlar

- **Kod dışı girdiler (docs/12):** Avukat onaylı metinler, sektörel satış kuralları (ör. 6136 sayılı kanun ve yaş sınırı) ve KVKK danışmanının saklama süreleri bu kararın varsayımlarını kesinleştirir. O zamana kadar taslaklar işaretli, süreler "öneri" olarak durur.
- **Ödeme yolu:** Yeni hata önekleri (`legal.`, `age.`) ödemesi alınmış sepeti tamamlayan yolda kalıcı sayılır ve iade akışına düşer. Onay ödeme formundan önce istendiği için bu durum yalnızca yarış ya da hile durumunda oluşur.
- **Vitrin işi:** Vitrin sözleşme metnini göstermeli ve onay ile yaş beyanını ödeme adımından önce göndermelidir (F18). Geliştirmedeki ödeme deneme sayfası (adr/0028) onay adımını taklit eder.
- **Silme ve anonimleştirme geri alınamaz:** Panel onay penceresi ve yeniden doğrulama ister (ADR-0040 §3).

## Ek (2026-11-04): taslak notu yayımlarken kalkar

Kullanıcı kararı (2026-11-04): başlangıç taslağının not kutusu yayımı engellemez.

- **Önce:** Kutu metinde durdukça yayım `legal.draft_note_present` ile reddediliyordu; mağaza kutuyu elle silmek zorundaydı. Sahibi yedi kez üst üste ret aldı.
- **Şimdi:** Yayım, `NOTE_MARK`'ı ("bir başlangıç iskeletidir") taşıyan her blok alıntıyı (not kutusunu) bütünüyle çıkarır; başka hiçbir şeye dokunmaz (`withoutStarterNote`, `lib/legal/starters/blocks.ts`). Eski sözlerle kaydedilmiş taslaklar da aynı işaretle bulunur.
- **Taslak satırı:** Not, taslak satırının kendisinden, yayımla aynı yazımda (`publishDraft`'ın `body` alanı, tek işlem) çıkarılır. Saklanan, özeti alınan (`body_hash`) ve vitrinde gösterilen metin aynıdır. Geri alınırsa (compensation) taslak, notuyla birlikte eski haline döner.
- **Önizleme:** "Müşterilerin göreceği biçimde" olduğu için notu göstermez.
- **Notun sözleri:** Artık "yayımlamadan önce silin" demiyor. Kutunun yalnız mağaza için olduğunu, yayımlarken kendiliğinden kalktığını ve avukatla kontrol etmeye değer noktaları söylüyor.
- **Panel:** Yayım onay penceresi tek pencere olarak kalır, çünkü yasal metni yayımlamak müşteriye dönüktür. Penceredeki avukat hatırlatması ve "TASLAK notu yayını engeller" uyarıları kaldırıldı. §1'deki "Yayımlarken panel bunu hatırlatır" cümlesinin yerini taslaktaki not kutusu alır.
- **Belirteç reddi kalır:** Bilinmeyen ya da yarım belirteç sözleşmede olduğu gibi basılırdı, bu yüzden red sürüyor. `legal.token_invalid` artık hatalı belirteçlerin hepsini sayar (`values.tokens`; panelde cümlenin içinde). Böylece hepsi tek seferde düzeltilir.

## Ek (2026-11-05): belirteçler okunur biçimde basılır

Yayındaki metinler telefonu `+905342551145`, siteyi `localhost:8000` diye saklandığı gibi basıyordu.

- **Telefon** (`{telefon}`, `{alıcı_telefon}`): nasıl yazılmış olursa olsun Türkçe okunuşla, `0534 255 11 45` (`readableTrPhone`, `lib/tr/phone.ts`). Türk numarası değilse yazıldığı gibi.
- **Site** (`{alan_adı}`): yalnız alan adı, şemasız ve sondaki eğik çizgisiz. Kanonik alan adı varsa o (`www.magaza.com`), yoksa geliştirme makinesinde vitrinin adresi (`localhost:8000`), canlıda boş (tire).
- **Tarih** (`{bugün}`, `{sipariş_tarihi}`): Türkçe uzun biçim, İstanbul saatiyle: `5 Kasım 2026`, `30 Ekim 2026 12:15`.
- **Tutar** (`{ara_toplam}`, `{kargo_ücreti}`, `{indirim}`, `{toplam}`, satır tablosu): fiyatların yazıldığı biçim, `1.500,00 TL` (`formatLira`, `lib/money/format.ts`; vitrin ve SEO ile aynı). İndirim vitrindeki eksiyle: `−150,00 TL`.
- **Adres** (`{teslimat_adresi}`, `{fatura_adresi}`): zarftaki sırayla tek satır, posta kodu ilçeden önce: `Moda Mah., Atatürk Cad. No: 5, 34710 Kadıköy / İstanbul`; ilçe ile il aynıysa bir kez.
- **Serbest metin** (`{adres}`, unvan vb.): tek satır; sekme ve satır sonu boşluk olur, sözcükler birleşmez.
- Biçimler `lib/legal/format.ts` ve `lib/legal/shop-values.ts`'te; her belirtecin basılan biçimi birim testinde (`token-values.unit.spec.ts`). Önizlemenin örnek siparişi de aynı yoldan doldurulur.
