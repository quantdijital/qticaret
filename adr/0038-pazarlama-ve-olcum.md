# ADR-0038: Pazarlama ve ölçüm: terk edilmiş sepet, İYS, ürün feed'leri, dönüşüm olayları, Search Console

- **Durum:** Önerildi (2026-10-28; kullanıcının "önerileni uygula" kuralıyla otonom kabul edilir, PROGRESS "Gözden geçir"de)
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
     - `ai_content_drafts` bayrağı, kapalı başlar;
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
  - İzin kaydı adresi özetin yanında `PII_ENCRYPTION_KEY` ile şifreli olarak da tutar (`recipient_encrypted`). Bu kopya yalnızca İYS'ye iletmek için çözülür.
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
- **Bekleyen dış bilgi:**
  - Akakçe ve Cimri herkese açık bir XML biçimi yayımlamıyor. Biçim, mağazanın satıcı panelinden alınınca her biri tek bir biçimleyici olarak eklenecek.
  - Merchant API ile gönderim M13'te.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| Hatırlatma işaretini sepet `metadata`'sına yazmak (Medusa rehberi) | Tablo yok | Yazım `updated_at`'i değiştirir; müşteri `metadata`'ya yazabilir |
| Feed'i herkese açık sabit URL'den sunmak | Basit | Rakip kataloğu ve fiyatları toplu çeker; tahmin edilebilir URL |
| Çerez onayını yalnızca vitrinde uygulamak | Sunucu basit | Sunucu olayı onaydan bağımsız gider; KK5 sağlanmaz |
| Her mağazaya kendi Google Cloud projesi | Tam yalıtım | Mağaza sahibinden OAuth uygulaması ve doğrulaması beklenemez |
| İYS'ye doğrudan bağlanmak | Aracı yok | Mağaza başına ayrı İYS API erişimi gerekir; Netgsm aynı hesapla sunuyor |

## Sonuçlar

- Kod dışı gereksinimler (docs/12):
  - platform Google Cloud projesi ve OAuth doğrulaması;
  - mağazanın Merchant Center ve Search Console mülkü;
  - İYS marka kodu;
  - Meta ve GA4 hesapları;
  - Akakçe ve Cimri'nin güncel XML şemaları (mağazanın satıcı panelinden);
  - LLM sağlayıcısı ve veri işleme sözleşmesi.
- Vitrin (F18) çerez onayını ve izin kutularını sepet/hesap uçlarına yazar. Sözleşme `packages/types`'a girer.
- Panel:
  - Ayarlar > Pazarlama: feed'ler ve token, Meta, GA4, terk edilmiş sepet;
  - Ayarlar > Entegrasyonlar: Google bağlantısı;
  - SEO paneli: GSC ve CWV kartları.
