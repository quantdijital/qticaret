# ADR-0038: Pazarlama ve ölçüm: terk edilmiş sepet, İYS, ürün feed'leri, dönüşüm olayları, Search Console

- **Durum:** Kabul edildi (önerildi 2026-10-28, otonom uygulandı; kullanıcı 2026-10-30 bütün otonom kararları kabul etti)
- **Tarih:** 2026-10-28
- **İlgili:** F10.7–F10.9, F10.11, F10.13; ADR-0036 (izin ve bildirimler), ADR-0027 (hesaplar panelden), ADR-0014 (iş altyapısı), ADR-0005 (LLM), docs/entegrasyonlar/pazarlama.md, docs/13 §10, docs/14

## Bağlam

F10'un pazarlama tarafı mağazanın verisini dış servislere taşır: Google, Meta, fiyat karşılaştırma siteleri ve İYS. Kısıtlar:

- **Kişisel veri:** dönüşüm olayları çerez onayına bağlıdır. Ticari ileti izne bağlıdır ve izin İYS'ye iletilmelidir (6563 sayılı Kanun).
- **Tek kaynak:** feed'deki fiyat, stok ve GTIN, sayfa JSON-LD'siyle aynı yerden üretilmelidir. Google otomatik ürün güncellemeleri bu eşleşmeye bakar (docs/13 §10).
- **Content API for Shopping** 18 Ağustos 2026'da kapandı. Yeni entegrasyon yalnızca Merchant API ile yapılır.
- **Medusa'da:**
  - Sepet tamamlanma olayı yok; `order.placed` kullanılır.
  - Sipariş düzeyinde iade olayı yok. `payment.refunded {id}` ve bizim `return.refunded` olayımız var.
  - Sepette `updated_at`'e dokunan her yazım hatırlatma zamanlamasını kaydırır. Müşteri `metadata`'ya yazabildiği için güvenilen işaret oraya konmaz.
- **Dış API'ler** her görevin başında resmî belgeden doğrulanır: Merchant API, Meta Conversions API, GA4 Measurement Protocol, Search Console, CrUX, Netgsm İYS.

## Karar

1. **Terk edilmiş sepet (F10.7).**
   - 15 dakikada bir iş. Hedef: e-postası olan, tamamlanmamış, son değişikliği ayarlanan süreden (varsayılan 1 saat) eski ve 7 günden yeni sepetler.
   - Hatırlatma ticari iletidir. Alıcının e-posta kanalında izni (`granted`) yoksa gitmez. Bastırma listesi de geçerlidir.
   - Sepet başına tek hatırlatma. Bu kayıt kendi tablomuzda tutulur, sepete yazılmaz.
   - Geri dönüş bağlantısı tek kullanımlık, süreli ve imzalı bir token taşır; sepeti açar, kullanılınca geçersiz olur.
   - Her ticari e-postaya F9'dan devredilenler eklenir:
     - `List-Unsubscribe` ve `List-Unsubscribe-Post` başlıkları;
     - tek tıkla çıkış ucu (RFC 8058). Ucu imzalı token korur; çıkış izni geri alır ve izin olayına yazar.
2. **İzin vitrinde alınır ve İYS'ye iletilir.**
   - Store uçları:
     - checkout'ta ve hesapta e-posta ve SMS izni verme veya geri alma;
     - kayıt olayına kaynak, zaman, metin sürümü ve IP özeti kanıt olarak yazılır.
   - İzin olayları değiştirilemez: güncelleme ve silme kapalı, denetim kaydı gibi.
   - Panelden verilen izin kanıt notu ister.
   - İletim:
     - Bekleyen değişiklikleri (`iys_status: pending`) bir iş İYS'ye iletir. Yol mağazanın Netgsm hesabının İYS API'si ve marka kodudur (ADR-0036 §6).
     - Sonuç izin kaydına yazılır.
     - Sahte İYS sunucusuyla test edilir.
3. **Ürün feed'leri (F10.8) ve Merchant API.**
   - `marketing-feeds` modülü, `FeedFormatter` arayüzü: Google (RSS 2.0 + `g:` ad alanı), Meta (CSV), Akakçe ve Cimri (XML). Yeni hedef yeni bir biçimleyicidir.
   - Ürün, fiyat (KDV dahil), stok ve GTIN, JSON-LD'yi üreten aynı fonksiyondan okunur. Eşitlik testlidir (KK4).
   - Üretim:
     - Worker'da periyodik iş (ADR-0014), çıktı özel dosya deposuna.
     - Dış dünyaya `/feeds/:token/<hedef>` ucundan sunulur; token tahmin edilemez, panelden yenilenir, sabit zamanlı karşılaştırılır.
     - Varsayılan olarak dışarıda kalanlar: yayında olmayan, stokta olmayan ve kısıtlı kategorideki ürünler (F13.4).
   - Merchant API'ye ürün gönderimi Google bağlantısıyla yapılır (madde 5). Feed dosyası yedek olarak kalır.
4. **Sunucu taraflı dönüşüm olayları (F10.9).**
   - Vitrin, çerez onayının durumunu (`analytics`, `marketing`, zamanı) sepete kendi ucumuzla yazar; kendi tablomuzda tutulur, sipariş oluşunca siparişe geçer. Onay müşterinin kendi beyanıdır, kaynağı vitrindir.
   - Onay yoksa olay gönderilmez (KK5). Kural olay başına değerlendirilir:
     - Meta: `marketing`;
     - GA4: `analytics`.
   - Kimlik bilgileri panelden girilir (`integration-credentials`, ADR-0027):
     - Meta piksel kimliği ve erişim anahtarı;
     - GA4 ölçüm kimliği ve API sırrı.
   - E-posta ve telefon sağlayıcının istediği biçimde normalleştirilir ve SHA-256 ile özetlenir. Ham hali ne gider ne loglanır.
   - `event_id` sipariş kimliğidir; tarayıcı pikseliyle çift sayım önlenir.
   - Olaylar:
     - satın alma: `order.placed`;
     - iade: `return.refunded` ve `payment.refunded`.
5. **Google bağlantısı: Search Console, Merchant API (F10.11, F10.8).**
   - Platformun tek bir Google Cloud OAuth uygulaması vardır. Hassas kapsamlar için Google doğrulaması kod dışı gereksinimdir (docs/12).
   - Mağaza Search Console mülkünü ve Merchant hesabını panelden bağlar:
     - OAuth `state` ve PKCE kullanılır;
     - yenileme token'ı `integration-credentials`'ta şifreli durur;
     - kapsamlar en dar olanlardır.
   - `seo-insights` modülü:
     - Search Analytics (günlük);
     - site haritası gönderimi;
     - URL Inspection kotayla: 2.000/gün/site; önce yeni ve değişen ürünler, kalanı örneklem.
     - CrUX haftalık. CrUX herkese açık veridir, platformun API anahtarıyla okunur.
   - Sonuçlar danışmanın S-GSC-01 ve S-CWV-01 kurallarını besler (docs/14). Panelde SEO kartları gösterilir.
6. **LLM taslakları (F10.13), ADR-0005'e uygun.**
   - Bu fazda yazılanlar:
     - `ContentDraftProvider` arayüzü;
     - `content.ai_drafts` bayrağı, kapalı başlar;
     - aylık kota;
     - kişisel veri süzgeci: istemde yalnızca ürün ve içerik alanları, e-posta, telefon, ad ve adres biçimleri reddedilir;
     - "AI taslak" kaydı ve kural motoru kapısı;
     - onaysız yayımlamanın engeli;
     - sahte sağlayıcıyla testler.
   - Gerçek sağlayıcı kullanıcının seçimine ve veri işleme sözleşmesine (docs/12) bağlıdır. ADR-0005 gereği kural motoru canlıda kullanıldıktan sonra açılır.

## Uygulama notları (M3, 2026-10-28)
- **İzin kanıtı:**
  - Her izin olayında `evidence` alanı var.
  - Vitrinden gelen izinde metin sürümü (`text_version`) ve IP'nin anahtarlı özeti (`ip_hash`, `PII_HASH_KEY`) tutulur. Checkout izninde bunlara sipariş ve sepet kimliği eklenir. Panelden verilen izinde personelin notu (`note`, en az 10 karakter) zorunludur.
  - Hiçbir kanıtta adres yok.
  - İzin olaylarının üretilen yazıcıları kapalı: güncelleme, silme ve geri getirme `NOT_ALLOWED` döner. Olay yalnızca `recordConsent` ve `revokeByHash` ile yazılır (denetim kaydının deseni).
- **Vitrin uçları:**
  - `GET` ve `POST /store/customers/me/consents`.
  - `POST /store/carts/:id/consents` (`email`, `sms`, `text_version`). İşaretli kutular sepette `checkout_consent` satırında bekler. `order.placed` olayında siparişin e-postası ve telefonu için kaydedilir, sonra satır silinir.
  - İşaretsiz kutu var olan izni geri almaz.
- **Abonelikten çıkış:**
  - Bağlantı `BACKEND_URL/unsubscribe?t=<alıcı özeti>.<HMAC>` biçimindedir. Adres içermez ve süresi dolmaz (RFC 8058).
  - `GET` yalnızca bir onay sayfası gösterir. E-posta tarayıcıları bağlantıyı açtığında kimsenin izni gitmesin diye geri alma bu adımda yapılmaz.
  - `POST` (sayfadaki düğme ya da posta istemcisinin tek tıkla çıkışı) e-posta iznini `unsubscribe` kaynağıyla geri alır.
  - Sayfanın CSP'si: `default-src 'none'`, `form-action 'self'`; ayrıca `noindex`.
  - Ticari e-postada `List-Unsubscribe` ve `List-Unsubscribe-Post: List-Unsubscribe=One-Click` başlıkları ile altbilgide "Bu iletileri almak istemiyorum" bağlantısı bulunur.
  - `BACKEND_URL` yoksa (yerelde) bağlantı da başlık da konmaz.

## Uygulama notları (M10, terk edilmiş sepet, 2026-10-29)
- **Ayar:**
  - `marketing` bölümü: `abandoned_cart_enabled` (varsayılan kapalı) ve `abandoned_cart_delay_minutes` (30–1440, varsayılan 60).
  - Panelde Ayarlar > Pazarlama (Satış ve teslimat grubunda).
  - Mağazanın alan adı yoksa iş hiç çalışmaz; bağlantının açılacağı sayfa yoktur.
- **İş (`cart-reminders`, 15 dakikada bir, tur başına en çok 100 sepet):**
  - Aday sepet: e-postası ve satırı olan, tamamlanmamış, ayarlanan süreden eski ve 7 günden yeni.
  - Daha önce hatırlatılan sepet atlanır.
  - Sepetin son değişikliğinden sonra aynı e-postayla sipariş vermiş alışverişçinin sepeti atlanır.
- **Sepet başına tek hatırlatma (`cart-reminders` modülü, `cart_reminder` tablosu):**
  - Gönderimden önce sepet "talep edilir" (benzersiz `cart_id`), sonuç satıra yazılır.
  - `sent`, `no_consent`, `suppressed`, `invalid_recipient`: hatırlatma hakkı kullanılmış sayılır.
  - Kanal kapalı, günlük kota dolu ya da sağlayıcı hatası: talep silinir, sonraki tur yeniden dener.
  - Gönderim hata fırlatırsa talep silinir. E-posta geri alınamayacağı için başka telafi yoktur.
- **İzin:** Şablon (`cart.reminder`) ticari iletidir. `deliver()` e-posta izni (`granted`) ve bastırma listesini denetler. İzinsiz adrese gitmez (KK3, testli).
- **Geri dönüş bağlantısı:**
  - Biçim: `<vitrin>/sepet/geri-don?token=…`.
  - Token 32 rastgele bayttır; yalnızca SHA-256 özeti saklanır, 7 gün geçerlidir.
  - `POST /store/cart-reminders/redeem` sepet kimliğini bir kez döndürür. Kullanılmış, süresi dolmuş ya da bilinmeyen token ile tamamlanmış sepet `cart_reminders.link_invalid` (404) alır.
  - Hız sınırı: `cart_return` profili, IP başına 15 dakikada 30 istek.
  - Token hiçbir iş akışı kaydında tutulmaz (testli).
  - "İmzalı token" yerine rastgele token ve saklanan özet kullanıldı. İkisi de tahmin edilemez, bu yol tek kullanımı da sağlar.
- **F18 için not:** Vitrinin geri dönüş sayfası token'ı sayfa açılınca değil, alışverişçi düğmeye basınca kullanmalı. Aksi halde e-posta güvenlik tarayıcıları bağlantıyı açıp token'ı tüketir.
- **Panel:**
  - Son 30 günün özeti: gönderilen, sepete dönen, siparişe dönüşen (`GET /admin/cart-reminders/summary`).
  - Bildirimler > şablon önizlemesinde "Terk edilmiş sepet hatırlatması".
- **Bilinen sınır:** Aynı token'la aynı anda gelen iki istek ikisi de sepeti açabilir (satır kilidi yok). Etkisi aynı sepetin iki kez açılmasıdır.

## Uygulama notları (M11, İYS iletimi, 2026-10-29)
- **Netgsm'in İYS API'si** (resmî PHP paketi `netgsm/netiys` kaynağından doğrulandı):
  - İstek: `POST https://api.netgsm.com.tr/iys/add`, JSON. Gövde `{ header: { username, password, brandCode }, body: { data: [ … ] } }`.
  - Kayıt alanları:
    - `type`: `MESAJ`, `ARAMA` ya da `EPOSTA`;
    - `source`: `HS_…`;
    - `recipient`: `+905XXXXXXXXX` ya da e-posta;
    - `status`: `ONAY` ya da `RET`;
    - `consentDate`: `YYYY-MM-DD HH:mm:ss`;
    - `recipientType`: `BIREYSEL` ya da `TACIR`.
  - Yanıt: `code` 0 ve `uid`, ya da bir kod ve hata.
  - Sorgulama ucu `/iys/search` sahte sunucuda var; henüz kullanılmıyor.
- **Hesap:**
  - Netgsm hesap ayarlarına `iys_brand_code` (yalnızca rakam) eklendi. Panelde Ayarlar > SMS > Netgsm > İYS bölümünden girilir.
  - Marka kodu yoksa izinler `pending` kalır ve iletilmez.
- **Adres:**
  - İzin kaydı adresi özetin yanında `PII_ENCRYPTION_KEY` ile şifreli olarak da tutar (`recipient_encrypted`). Bu kopya yalnızca İYS'ye iletmek için çözülür. **Ek (2026-11-03, adr/0050):** amaç "İYS'ye iletmek ve izin verilen toplu iletiyi göndermek" olarak genişledi; müşteri kaydı olmayan bülten abonesine kampanya giderken adres yalnız gönderim anında, bellekte çözülür, alıcı tablosuna yazılmaz (KVKK envanteri `bulk_message_recipient`).
  - Hiçbir uç bu alanı döndürmez.
  - Bu değişiklikten önceki satırların şifreli adresi yok. Bunlar `failed` ve `no_address` olarak işaretlenir.
- **Eşleme:**
  - Kanal: e-posta `EPOSTA`, SMS `MESAJ`, arama `ARAMA`.
  - Kaynak:
    - vitrin (checkout, hesap, abonelikten çıkış): `HS_WEB`;
    - panel: `HS_FIZIKSEL_ORTAM`;
    - içe aktarma: `HS_EORTAM`.
  - İYS'den gelen değişiklik (`iys`) geri gönderilmez (`not_required`).
  - Tarih Türkiye saatiyle yazılır. Alıcı tipi `BIREYSEL`.
- **İş (`iys-sync`, 10 dakikada bir, tur başına en çok 200):**
  - Bekleyen satırlar en eskiden başlayarak tek tek iletilir. Kanun izin için 3 iş günü verir.
  - Başarı `sent` ve `iys_sent_at` olarak, İYS'nin reddi `failed` ve `iys_error` (`iys_70` gibi) olarak işaretlenir.
  - Hesap reddi (`iys_30` giriş, `iys_40` marka kodu) ya da ulaşılamama turu durdurur; satırlar bekler.
  - İletim sırasında yeniden değişen satırın işareti atlanır; yeni cevap beklemeye devam eder.
  - Telafi yok: İYS aynı izni yeniden almakta sakınca görmez, satır yanıttan sonra işaretlenir.
- **Panel:** Ayarlar > SMS'te "İYS iletimi" kartı: bekleyen, iletilen, reddedilen; marka kodu yoksa uyarı (`GET /admin/messaging/iys`).
- **Kod düzeni:** Mesajlaşma servisi 300 satır sınırı için ikiye bölündü: izin kayıtları `ConsentRecords` taban sınıfında, bastırma listesi `MessagingModuleService`'te. Tipler `modules/messaging/types.ts` dosyasında.
- **Gözden geçir:**
  - Panelden girilen iznin İYS kaynağı her zaman `HS_FIZIKSEL_ORTAM`. Telefonla ya da ıslak imzayla alınan izin için panelde kaynak seçimi gerekebilir.
  - İYS'den gelen değişikliklerin (vatandaşın İYS'den ret vermesi) Netgsm web kancasıyla alınması sonraya kaldı.

## Uygulama notları (M12, ürün feed'leri, 2026-10-29)
- **Kaynak:**
  - Feed kalemleri, sayfanın JSON-LD'sini üreten `productFacts` fonksiyonundan çıkar: fiyat (30 gün kuralıyla üstü çizili fiyat dahil), stok, kodlar ve kargo ücreti.
  - Varyant bağlantısı, JSON-LD teklifinin adresiyle aynıdır (`?variant=`).
  - Eşitlik testli (KK4): feed fiyatı ile `/store/seo/resolve` teklif fiyatı aynı.
- **Dışarıda kalanlar:**
  - yayında olmayan, mağaza adresi olmayan ürünler;
  - fiyatı olmayan, stokta olmayan varyantlar;
  - görseli olmayan kalemler (Google ve Meta reddeder);
  - Google'da ön sipariş (`availability_date` zorunlu, katalogda tarih yok).
  - Kısıtlı kategori dışlaması F13.4 ile gelecek.
- **Biçimleyiciler (`lib/feeds`, `FeedFormatter`: `accepts` + `render`):**
  - Google:
    - RSS 2.0 ve `g:` ad alanı;
    - indirimde `price` üstü çizili fiyat, `sale_price` ödenen fiyat;
    - GTIN de MPN de yoksa `identifier_exists=no`;
    - `damaged` durumu `used` olarak yazılır;
    - renk, beden, malzeme ve desen eklenir. Cinsiyet ve yaş grubu eklenmez: Google sabit kelimeler ister, mağazanın kendi değerleri onlar değil.
  - Meta:
    - CSV;
    - formül enjeksiyonuna karşı `= + - @` ile başlayan hücreler kaçışlanır.
- **Şema denetimi (`googleFeedProblems`):**
  - Google belirtiminin zorunlu alanlarını ve değerlerini denetler.
  - Üretimde sorun sayısı loglanır; testte sıfır olması beklenir.
  - Belirtim resmî kaynaktan doğrulandı: support.google.com/merchants/answer/7052112.
- **Erişim:**
  - `GET /feeds/:token/:target`; hız profili `feed`, IP başına 15 dakikada 60 istek.
  - Token tek tanedir: anahtarlı özetiyle sabit zamanlı karşılaştırılır. Şifreli kopyası, panelin adresi yeniden gösterebilmesi için tutulur.
  - Yanlış token ile bulunmayan feed aynı 404'ü alır.
  - Yanıt başlıkları: `X-Robots-Tag: noindex`, `Cache-Control: private, max-age=300`.
- **Üretim:**
  - `marketing-feeds` işi iki saatte bir çalışır; panelden "Şimdi güncelle" ile de tetiklenir.
  - Dosyalar özel depoya yazılır. Yeni dosya kaydedilince eskisi silinir; kaydedilemezse yenisi silinir.
  - Mağaza alan adı yoksa ya da feed'ler kapalıysa üretim yapılmaz.
- **Panel:**
  - Ayarlar > Pazarlama > Ürün feed'leri: aç, kapat, adresi yenile (onaylı), şimdi güncelle.
  - Kopyalanabilir adresler; ürün sayısı ve son güncelleme zamanı.
  - Alan adı yoksa uyarı.
- **Merchant API ile gönderim** M13'te.

## Uygulama notları (M12 eki, Akakçe, Cimri ve feed kuralları, 2026-10-29)
- **Biçimlerin kaynağı:** Akakçe ve Cimri herkese açık şema yayımlamıyor. Biçimler, mağazanın önceki sitesinin (WordPress eklentisi) bu sitelere gönderdiği ve kabul edilen feed'lerden alındı.
  - **Cimri:** RSS 2.0 ve `g:` ad alanı. Alanlar: başlık, bağlantı, açıklama, `g:id`, `g:condition`, `g:price` (`1299.90 TRY`), `g:availability` (`in stock`), `g:image_link`, `g:brand` (yoksa mağaza adı), `g:mpn` (SKU, yoksa kimlik), `g:gtin`.
  - **Akakçe:** `<products><product>` yapısı. Alanlar: `sku`, `name`, `url`, `imgUrl`, `additionalimages`, `description`, `distributor`, `listPrice` ve `price` (noktalı), `shipPrice` ve `shipmentVolume` (virgüllü; desi, ölçü yoksa 1), `dayOfDelivery` (hazırlık süresinin üst sınırı), `expressDeliveryTime` (yalnızca mağaza aynı gün saati verdiyse), `quantity` (stok sayılmıyorsa 99), `productBrand`, `productCategory` (birincil kategorinin adı), `barcode`.
  - İkisi de yalnızca şimdi alınabilen ve görseli olan ürünleri listeler.
- **Kargo ücreti (tüm feed'ler ve Merchant API):**
  - Önce desi tablosunun ücreti (tablo fiyatlı seçenek vitrinde açıksa).
  - Yoksa vitrinde açık, mağazadan teslim olmayan en ucuz sabit ücretli seçenek. Ücretsiz kargo sınırını geçen ürün için 0.
  - İkisi de yoksa ücret yazılmaz.
  - Sabit seçeneğin fiyatı, ücretsiz kargo kuralı taşıyan 0 fiyatı değil mağazanın kendi fiyatıdır (`shopShippingOptions` artık kurallı fiyatı atlar; panel listesi de bundan yararlanır).
- **Google ve Meta eklemeleri:** `g:product_type` / `product_type` (birincil kategori yolu, `Mutfak > Tavalar`). `g:min_handling_time` / `g:max_handling_time` kargo ayarlarındaki gönderim günlerinden. Merchant API aynı değerleri `productTypes`, `shipping`, `minHandlingTime`, `maxHandlingTime` olarak alır (products_v1 başvurusundan doğrulandı).
  - Eklentideki sektöre özel Google kategori eşlemesi ve reklam grubu etiketleri alınmadı (CLAUDE.md: sektöre özel kod yok).
- **Feed kuralları (`marketing` bölümü):**
  - `feed_exclusions`: hedef başına dışarıda bırakılan kategori kimlikleri. Bir kategori, altındaki tüm kategorileri de kapsar (`mpath`). Merchant API gönderimi Google'ın listesine uyar.
  - `feed_same_day_cutoff_hour`: 1–23 ya da boş; Akakçe'nin `expressDeliveryTime` alanı.
  - Panel: Ayarlar > Pazarlama > Feed kuralları. Hedef seçilir, kategori ağacından işaretlenir, saat seçilir.

## Uygulama notları (M13, Google bağlantısı ve Merchant API, 2026-10-29)
- **Platform OAuth istemcisi:**
  - `GOOGLE_OAUTH_CLIENT_ID` ve `GOOGLE_OAUTH_CLIENT_SECRET` platformun tek Google Cloud web istemcisidir; her mağaza onunla bağlanır.
  - Yönlendirme adresi `BACKEND_URL/google/callback`. Panel ve backend aynı adreste (adr/0022 §4), dönüş panelin `/settings/marketing?google=<sonuç>` sayfasına. Google yorumları için başlatılan bağlantı (`state` öneki `r.`, `business.manage` kapsamı üstüne) `/reviews/google?google=<sonuç>`'a döner; bağlantı kesilince Google yorumları da silinir (adr/0058).
  - İkisi tanımlı değilse bağlantı sunulmaz.
  - `GOOGLE_BASE_URL` sahte Google içindir; canlıda reddedilir.
- **Akış** (Google OAuth 2.0 web sunucusu akışı, resmî belgeden):
  - `state` ve PKCE S256. Doğrulayıcı sunucuda şifreli tutulur; `state` özetiyle bulunur, 10 dakika geçerlidir, bir kez kullanılır ve personele bağlıdır (`google_oauth_state`).
  - Kapsam: `auth/content`, `openid` ve `email`. Bağlı hesabın adresi ID token'dan okunur; token uç noktasından geldiği için yeniden doğrulanmaz.
  - `access_type=offline` ve `prompt=consent` ile her seferinde yenileme token'ı alınır.
  - Kod takası bir adımdır; telafisi token'ı Google'da iptal etmektir. Saklama ayrı bir adımdır; telafisi hesabı eski haline koymaktır.
- **Saklama:**
  - Yenileme token'ı `integration-credentials` içinde `google` sağlayıcısı olarak tutulur (adr/0027 anahtarı ve denetimi).
  - Ayarlar: `email`, `merchant_id` ve otomatik oluşturulan `data_source`.
  - Hesap denetimi:
    - token yenilenmezse (`invalid_grant`) `secret_invalid`;
    - Merchant hesabına erişilemezse (`PERMISSION_DENIED`, `NOT_FOUND`) `merchant_invalid`.
  - Hiçbir yanıt token döndürmez (testli).
- **Merchant API** (`products_v1` ve `datasources_v1` referanslarından):
  - İlk gönderimde bir API veri kaynağı oluşturulur: `contentLanguage` tr, `feedLabel` TR, `countries` [TR].
  - Ürünler `productInputs:insert` ile gönderilir. Kalemler Google feed'iyle aynıdır (`googleFeedFormatter.accepts`).
  - Fiyat kuruş üzerinden mikro birime çevrilir: 249,90 → `249900000`.
  - `merchant_offer` tablosu gönderilenin özetini tutar. Değişmeyen kalem yeniden gönderilmez; satıştan kalkan kalem silinir. Silme adı base64url `tr~TR~<offerId>`.
  - Bir turda en çok 1000 çağrı yapılır.
  - Google'ın bir kalemi reddetmesi (`INVALID_ARGUMENT`) sayılır ve geçilir. Hesap reddi ya da ulaşılamama turu durdurur; son tur `merchant_sync` tablosuna yazılır.
- **İş:** `google-merchant-sync`, iki saatte bir (feed'den 30 dakika sonra).
- **Panel:** Ayarlar > Pazarlama > Google Merchant Center:
  - platform istemcisi yoksa bilgi;
  - "Google hesabını bağla" (Google'ın ekranına yönlendirir);
  - bağlı hesap, Merchant hesap numarası (Google'la denetlenerek kaydedilir), son gönderim, "Şimdi gönder", "Bağlantıyı kaldır" (onaylı; erişim Google'da iptal edilir);
  - dönüş sonucu bir kez bildirim olarak gösterilir.
- **Gözden geçir / dış bilgi:**
  - Platformun Google Cloud projesi, OAuth onay ekranı doğrulaması (hassas kapsam: `auth/content`) ve her mağaza adresinin yönlendirme adresi olarak kaydı kurulumda yapılmalı.
  - Bağlantı kaldırılınca Merchant Center'daki ürünler orada kalır; süreleri dolana ya da mağaza silene kadar.
  - Search Console (M15) aynı bağlantıyı ek kapsamla kullanacak.

## Uygulama notları (M14, sunucu taraflı dönüşüm olayları, 2026-10-29)
- **Çerez onayı:**
  - `POST /store/carts/:id/tracking` şunları alır: `analytics`, `marketing`, `ga_client_id` (`_ga`), `fbp`, `fbc` ve `page_url`. Biçimleri kalıpla denetlenir.
  - IP ve tarayıcı bilgisi (user agent) istekten alınır; yalnızca pazarlama izniyle ve şifreli olarak tutulur.
  - Kayıt `conversions` modülünün `tracking_consent` tablosundadır; sipariş oluşunca siparişe taşınır.
  - Onay müşterinin kendi beyanıdır; kaynağı vitrinin çerez bildirimidir (F18 kurar).
- **Kural (KK5, testli):**
  - Meta yalnızca pazarlama izniyle gider.
  - GA4 yalnızca analiz izni ve GA4 istemci kimliğiyle gider. Reklam izinleri (`ad_user_data`, `ad_personalization`) pazarlama iznine göre `GRANTED` ya da `DENIED` olur.
  - İzin yoksa hiçbir olay gönderilmez ve kayıt da açılmaz.
- **Meta Conversions API** (resmî belgeden):
  - `POST graph.facebook.com/v26.0/{pixel}/events?access_token=` ile `Purchase` gönderilir. `event_id` sipariş kimliğidir; tarayıcı pikseliyle çift sayımı önler.
  - E-posta ve telefon normalleştirilip SHA-256 ile özetlenir. Telefon, ülke koduyla rakamlardan oluşur.
  - IP, tarayıcı bilgisi, `fbp` ve `fbc` özetlenmez (Meta öyle ister).
  - Test Events kodu panelden girilebilir.
  - Hesap denetimi: piksel kaydı okunur; `190` token reddi, `100` piksel reddi demektir.
  - Meta'da iade olayı yok.
- **GA4 Measurement Protocol:**
  - `POST /mp/collect?measurement_id=&api_secret=` ile `purchase` gönderilir; `transaction_id` sipariş kimliğidir.
  - İade `refund` olayıyla gider:
    - `return.refunded` olayında iade tutarıyla (kuruştan lira);
    - `order.canceled` olayında siparişin tamamıyla.
  - GA4 her isteğe 2xx döndüğü için hesap denetimi yalnızca biçimdir.
- **Bir kez gönderim:**
  - Her olay benzersiz bir `event_key` ile önce sahiplenilir (`pending`), sonra gönderilir.
  - Medusa'nın veri yolu aynı olayı aynı anda iki kez teslim ettiğinde yalnızca biri gönderir. Bu yarış testte yakalandı ve düzeltildi.
  - Başarısız olay ya da 10 dakikadır askıda kalan olay koşullu bir SQL güncellemesiyle yeniden sahiplenilir.
- **Yeniden deneme ve saklama:**
  - `conversions-retry` işi 30 dakikada bir başarısız olayları en çok 5 kez ve 3 gün boyunca yeniden dener.
  - Meta'nın olayı gidince ya da 3 gün geçince IP, tarayıcı bilgisi ve Meta çerezleri silinir.
- **Panel:**
  - Ayarlar > Pazarlama > Dönüşüm ölçümü.
  - Meta ve GA4'ün her biri kendi hesap sayfasında, diğer sağlayıcılarla aynı düzende: durum rozeti; kaydet, denetle, bağlantıyı kes.
- **Gözden geçir:** GA4'te API sırrının doğruluğu ancak GA4 raporlarında görülür.

## Uygulama notları (M15, Search Console ve CrUX, 2026-10-29)
- **Bağlantı:**
  - Google bağlantısı (M13) Search Console'un tam kapsamını da ister (`auth/webmasters`), çünkü site haritası göndermek salt okuma kapsamıyla yapılamaz.
  - Verilen kapsamlar hesap ayarlarında (`scopes`) tutulur. Bu kapsam olmadan bağlanmış hesaba panel "Yeniden bağla" der.
  - Mülk (`gsc_site`), hesabın okuyabildiği mülkler arasından seçilir: `sites.list` ile listelenir; doğrulanmamış kullanıcı yetkisi sayılmaz.
- **Gece işi (`seo-insights`, 02:30 UTC, denetimden önce):** Her parça kendi başına çalışır ve sonucu `insight_run` tablosuna yazılır.
  - Site haritası gönderimi: `PUT …/sites/{mülk}/sitemaps/{vitrin}/sitemap.xml`.
  - Search Analytics:
    - sayfaya göre son 28 gün ile önceki 28 gün;
    - Search Console yaklaşık iki gün geriden geldiği için dönem 3 gün önce biter;
    - en çok 5000 satır;
    - tamamı her gece yenilenir.
  - URL Inspection:
    - kapsam: ürün ve kategori sayfaları;
    - sıra: hiç incelenmemiş olanlar önce, sonra 30 günden eskiler;
    - gecelik bütçe 100; Search Console'un sınırı mülk başına günde 2000.
  - CrUX:
    - platformun `CRUX_API_KEY` anahtarıyla, vitrin kaynağının telefon ve masaüstü p75 değerleri (LCP, INP, CLS);
    - yeterli veri yoksa (404) "veri yok" kaydedilir.
- **Danışman (KK7, testli):** S-GSC-01 ve S-CWV-01 mağaza denetimine eklendi. Eşikler docs/14'ten.
  - S-GSC-01:
    - dizinde olmayan site haritası sayfası;
    - tıklaması %30 ve üzeri düşen sayfa (önceki dönemde en az 20 tıklama);
    - 500 ve üzeri gösterimde tıklama oranı %1'in altında kalan sayfa.
  - S-CWV-01: LCP 2500 ms, INP 200 ms, CLS 0,1 üstü.
  - 7 günden eski veriyle bulgu üretilmez; bağlantı kaldırılınca eski veri bulgu bırakmaz.
- **Panel:**
  - SEO sayfasında "Google Arama" kartı: tıklama ve gösterimde önceki döneme göre değişim, tıklama oranı, ortalama sıra, dizindeki inceleme sayısı, tıklaması en çok düşen sayfalar, "Şimdi güncelle".
  - SEO sayfasında "Core Web Vitals" kartı: telefon ve masaüstü, Google çizgilerine göre iyi / geliştirilmeli / kötü.
  - Ayarlar > SEO > Search Console: mülk seçimi.
- **Bekleyen dış bilgi:**
  - platformun CrUX API anahtarı;
  - OAuth onay ekranında `auth/webmasters` kapsamının doğrulanması (M13 ile aynı süreç).

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| Hatırlatma işaretini sepet `metadata`'sına yazmak (Medusa rehberi) | Tablo yok | Yazım `updated_at`'i değiştirir; müşteri `metadata`'ya yazabilir |
| Feed'i herkese açık sabit URL'den sunmak | Basit | Rakip kataloğu ve fiyatları toplu çeker; tahmin edilebilir URL |
| Çerez onayını yalnızca vitrinde uygulamak | Sunucu basit | Sunucu olayı onaydan bağımsız gider; KK5 sağlanmaz |
| Her mağazaya kendi Google Cloud projesi | Tam yalıtım | Mağaza sahibinden OAuth uygulaması ve doğrulaması beklenemez |
| İYS'ye doğrudan bağlanmak | Aracı yok | Mağaza başına ayrı İYS API erişimi gerekir; Netgsm aynı hesapla sunuyor |

## Uygulama notları (M16, içerik taslakları, 2026-10-29)
- **İki kapı:**
  - Platform: `CONTENT_DRAFT_PROVIDER` tanımlı değilse taslak istenemez (`content_drafts.no_provider`). Sağlayıcı ancak seçimi ve veri işleme sözleşmesi tamamlanınca tanımlanır. Şimdilik yalnızca `fake` var; canlı ortamda reddedilir.
  - Mağaza: `content.ai_drafts` bayrağı mağazanındır (`owner: "tenant"`), kapalı başlar. Platform sahipli olsaydı F17'deki paket kurulumuna kadar açılamazdı; sağlayıcı kapısı platformun kararını zaten taşıyor.
- **Kota:**
  - `CONTENT_DRAFT_MONTHLY_QUOTA` (varsayılan 200), ay UTC'ye göre.
  - Sağlayıcıya sormadan önce tek SQL ifadesiyle düşülür; aynı anda gelen iki istek son hakkı paylaşamaz (modül testi).
  - Sağlayıcı hata verse de hak iade edilmez: istek gitmiş olabilir.
  - Personel başına ayrıca hız sınırı var (`content_draft`: IP başına 10 dakikada 30, kişi başına 20).
- **İstem:**
  - Yalnızca ürünün kendi alanları: ad, alt başlık, marka, kategori, mağaza adı, özellikler, mevcut açıklama.
  - Her değer kişisel veri süzgecinden geçer (e-posta, telefon, IBAN, kart, TCKN). İstem kayıtta saklanır; mağaza neyin gittiğini görebilir.
- **Kural motoru kapısı:** Taslak, alanının danışman kurallarından geçmezse `refused` olarak saklanır ve önerilmez (uzunluk, çok kısa, gürültü, bağlantı, kişisel veri).
- **Yayım:**
  - Taslak yalnızca personel onaylayınca sayfaya çıkar: açıklama `updateProductsWorkflow` ile, arama başlığı ve açıklaması `upsertSeoMetaWorkflow` ile. İkisi de kendi telafisiyle geri alınır, karar kaydı da geri döner.
  - Onay bekleyen olmayan taslak ikinci kez karara bağlanamaz (`content_drafts.not_open`).
- **Panel:** Ürün detayında İçerik taslakları kartı. Bayrak kapalıyken kart görünmez; sağlayıcı yoksa uyarı gösterir.
- **Testler:** HTTP 3 (`content-drafts`: bayrak kapalıyken ret, onaysız yayım yok, istemde kişisel veri yok, kota), modül 2 (kota yarışı, ay geçişi), birim 4, panel 2.

## Uygulama notları (M17, çift onaylı izin, 2026-10-29)
- **Sorun (kapanış güvenlik incelemesi):** İzin, sahibi olduğu kanıtlanmamış bir adres için kaydedilip İYS'ye bildiriliyordu.
  - Hesaba yazılan herhangi bir telefon numarası için izin verilebiliyor ya da o numaranın izni geri çekilebiliyordu.
  - Ödemede yazılan herhangi bir e-posta için de izin verilebiliyordu.
- **Kural:**
  - Hesaptaki **e-posta** izni doğrudan kaydedilir: adres, sahibinin doğruladığı giriş adresidir.
  - **Ödemede** işaretlenen e-posta ve SMS izinleri ile hesapta **telefona** verilen izin, adresin sahibine onay bağlantısı gönderir.
  - Hesaptaki telefon izni yalnızca kayıt müşterinin kendi kaydıysa doğrudan geri çekilir.
- **Onay isteği (`consent_request`):**
  - Adres şifreli ve anahtarlı özetiyle saklanır, bağlantının token'ı yalnızca özetiyle tutulur. Kanıt bilgisi isteğin üzerinde durur.
  - Bağlantı 7 gün geçerlidir ve bir kez kullanılır; tek bir koşullu `UPDATE … RETURNING` ifadesiyle tüketilir.
- **Onay sayfası:** `/consents/confirm?t=` önce sorar, izni POST kaydeder; böylece e-posta tarayıcıları bağlantıyı açsa bile izin kaydedilmez. Kayda `confirmed_at` eklenir. İYS'ye yalnızca onaylanan izin gider.
- **Gönderim:**
  - Onay iletisi `consent.confirm` şablonuyla e-posta ve SMS olarak gider.
  - Herkesin tetikleyebildiği e-postaların günlük payına (%25) dahildir.
  - Token yalnızca iletide bulunur; hiçbir workflow onu saklamaz.

## Sonuçlar

- Kod dışı gereksinimler (docs/12):
  - platform Google Cloud projesi ve OAuth doğrulaması;
  - mağazanın Merchant Center ve Search Console mülkü;
  - İYS marka kodu;
  - Meta ve GA4 hesapları;
  - LLM sağlayıcısı ve veri işleme sözleşmesi.
- Vitrin (F18) çerez onayını ve izin kutularını sepet/hesap uçlarına yazar. Sözleşme `packages/types`'a girer.
- Panel:
  - Ayarlar > Pazarlama: feed'ler ve token, Meta, GA4, terk edilmiş sepet;
  - Ayarlar > Entegrasyonlar: Google bağlantısı;
  - SEO paneli: GSC ve CWV kartları.

## Ek (2026-11-02): ileti bağlantılarının sayfaları vitrinde
- **Sorun:** Ticari ve işlem iletilerindeki token bağlantıları (çıkış, çift onaylı izin, stok bildirimi onayı) backend'in düz HTML sayfalarını açıyordu: mağazanın görünümü yok, başka host.
- **Karar:** Mağazanın host'u varken (`seo.canonical_host`, `brandOf().storefrontUrl`) bağlantılar vitrinin sayfalarına gider:
  - `/abonelik/cik?t=` → `POST /store/consents/unsubscribe` (imzalı alıcı özeti; geri çekme bir kez yazılır, ikinci basış aynı yanıtı verir).
  - `/abonelik/onay?t=` → `POST /store/consents/confirm` (`granted` ya da `revoked` döner; kullanılmış, süresi dolmuş ya da bilinmeyen token 400 `consents.link_invalid`).
  - `/stok-bildirimi/onay?t=` → `POST /store/stock-alerts/confirm` (400 `stock_alerts.link_invalid`).
  - Sayfa bağlantıyı açınca hiçbir şey yapmaz, önce sorar (e-posta tarayıcıları token harcamaz). Düğme Server Action'dır; sonuç sayfası `?sonuc=` ile döner, token adres çubuğundan çıkar. Bozuk bağlantı hata değil, "Bağlantı geçersiz" sayfasıdır (200).
  - Sayfalar `noindex,nofollow`, `Referrer-Policy: no-referrer`; kökler iki tarafta sistem yolu (`abonelik`, `stok-bildirimi`; docs/13 §6).
  - Store uçları token'ı gövdede alır, eski sayfalarla aynı kontrolleri yapar (iş mantığı `workflows/messaging/email-links.ts`; tek adımlı, modülün kendi işlemi; telafi gerektiren sonraki adım yok) ve aynı hız sınırı profilindedir (`webhook`, IP başına dakikada 600; vitrin imzalı müşteri IP'sini iletir). Rotalar `api/http/email-link-routes.ts`.
- **Gönderim:** `lib/messaging/links.ts` (`emailLinkUrl`) host varsa vitrin adresini, yoksa `BACKEND_URL`'deki eski sayfayı, ikisi de yoksa bağlantısız gönderir. Ticari e-postanın gövdesindeki çıkış bağlantısı vitrine gider; `List-Unsubscribe` başlığı (RFC 8058 tek tık POST) backend'in `/unsubscribe` adresinde kalır, çünkü posta istemcisi oraya POST eder.
- **Eski bağlantılar:** Gönderilmiş iletilerde oldukları için `/unsubscribe`, `/consents/confirm`, `/stock-alerts/confirm` kalır. Host varken GET 302 ile vitrin sayfasına gönderir (token biçimi uyuyorsa taşınır; `no-store`, `no-referrer`); yoksa eski sayfayı gösterir. POST'lar (sayfanın düğmesi, tek tık çıkış) çalışmaya devam eder.
- **Testler:** HTTP `consent-links.spec.ts` (6: geçerli/sahte/biçimsiz/tekrar token, süresi dolmuş onay ve stok bildirimi, eski adreslerin yönlendirmesi, host varken iletilerin vitrin bağlantısı ve backend tek tık başlığı, hız sınırı), birim `links`, `unsubscribe`, vitrin birim `email-links`, e2e `legal-links.e2e.ts`.
