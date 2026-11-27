# Google İşletme Profili (Google yorumları)

> adr/0058. Mağazanın Google İşletme Profili'ndeki yorumlar resmî Business Profile API'siyle okunur ve vitrinin `/yorumlar` sayfasında gösterilir. Kazıma ve Places API kullanılmaz. Güncel uçları Google'ın kendi belgesinden doğrula: developers.google.com/my-business.

## Ne kullanılıyor

| API | Uç | Ne için |
| --- | --- | --- |
| My Business Account Management API v1 | `GET mybusinessaccountmanagement.googleapis.com/v1/accounts` | Bağlı hesabın yönettiği işletme hesapları |
| My Business Business Information API v1 | `GET mybusinessbusinessinformation.googleapis.com/v1/{account}/locations?readMask=name,title,storefrontAddress,metadata` | Konumlar, adres, `metadata.mapsUri` ve `metadata.newReviewUri` |
| Google My Business API v4 | `GET mybusiness.googleapis.com/v4/{account}/{location}/reviews?pageSize=50` | Yorumlar, `averageRating`, `totalReviewCount` |

- OAuth kapsamı: `https://www.googleapis.com/auth/business.manage` (hassas kapsam).
- Bağlantı mağazanın mevcut Google bağlantısıdır (Merchant Center ve Search Console'la aynı istemci ve token). Bu kapsam yalnız panelde "Google yorumlarını bağla"ya basılınca, öncekilerin üstüne istenir.
- Kota proje başınadır: onaylı projede dakikada 300 istek. Günlük eşitleme mağaza başına birkaç istektir.

## Canlıya almak için (platform ve sahip)

Platformun bir kez yapacakları (mağaza başına değil):

1. **Google Cloud projesi:** platformun OAuth istemcisinin (`GOOGLE_OAUTH_CLIENT_ID`) bulunduğu proje. Yeni proje açılmaz.
2. **Proje numarası:** Cloud Console > proje panosu > "Project info" kartındaki **Project number**. Başvuruda istenir.
3. **API erişim başvurusu:** Google'ın Business Profile API iletişim formunda "Application for Basic API Access" seçilir.
   - Başvuran e-posta, doğrulanmış bir işletme profilinin sahibi ya da yöneticisi olmalı.
   - Google'ın koşulları: profil **doğrulanmış ve en az 60 gündür etkin**, profilde işletmenin **web sitesi** var.
   - Proje numarası ve kullanım amacı (mağazaların kendi yorumlarını kendi sitelerinde göstermek) yazılır.
4. **Onayı kontrol et:** Cloud Console > APIs & Services > Business Profile API'lerinin kotaları.
   - **0 QPM:** onaylanmadı (bu durumda eşitleme `http_429` ile durur, backend `google_reviews.sync_failed` error log'u yazar).
   - **300 QPM:** onaylandı.
   - Reddedilirse koşullar tamamlanıp yeniden başvurulur.
5. **API'leri aç** (onaydan sonra görünür): Cloud Console > APIs & Services > Library:
   - My Business Account Management API
   - My Business Business Information API
   - Google My Business API
   (Google'ın kurulum sayfası yedi Business Profile API'sinin açılmasını önerir; bu özellik bu üçünü kullanır.)
6. **OAuth onay ekranı:** kapsamlara `https://www.googleapis.com/auth/business.manage` eklenir. Hassas kapsam olduğu için Google'ın **uygulama doğrulaması** gerekir (`auth/content` ve `auth/webmasters` için yapılan doğrulamayla aynı süreç, adr/0038 §5). Doğrulama tamamlanana kadar mağazalar "doğrulanmamış uygulama" uyarısı görür ve test kullanıcı sınırı uygulanır.
7. **Yönlendirme adresi:** değişmez, her mağazanın `BACKEND_URL/google/callback` adresi zaten kayıtlı olmalı. Adres panelin origin'idir (`panelUrl()`): canlıda panel ve backend aynı host'ta olduğundan `BACKEND_URL`'dir; reverse proxy (F16) `/google/callback`'i backend'e geçirmelidir. Yerelde `http://localhost:5173/google/callback`; Vite proxy'si `/google`'ı oturum çereziyle backend'e iletir.

Mağazanın yapacakları:

1. İşletme profili doğrulanmış olmalı (Google Haritalar'da görünen işletme).
2. Panel > Yorumlar > **Google yorumları** > "Google yorumlarını bağla": profilin sahibi ya da yöneticisi olan Google hesabıyla giriş, Google'ın ekranında "Google'daki işletmelerinizi görme, düzenleme…" izninin işaretli kalması.
3. Tek konum varsa kendiliğinden seçilir ve yorumlar hemen okunur; birden çoksa listeden seçilir.

## Davranış

- **Eşitleme:** her gün 04:20 UTC, konum seçilince ve panelde "Şimdi eşitle"yle. Yeni yorum eklenir, değişen güncellenir, Google'da silinen silinir.
- **30 gün:** Business Profile API politikaları saklanan içeriği en çok 30 gün sayar. Son başarılı eşitleme 30 günden eskiyse yorumlar, ortalama ve sayı silinir (`google_reviews.stale_purged`); vitrin eski içeriği göstermez.
- **Puan Google'ındır:** ortalama ve sayı Google'ın yanıtından gelir, hesaplanmaz, kendi yorumlarımızla birleştirilmez.
- **Vitrinden kaldırma:** yalnız üç gerekçeyle, tek tek: kişisel veri, hakaret/küfür/nefret söylemi, konu dışı/spam. Puanı nedeniyle kaldırma yok, toplu kaldırma yok. Gerekçe, kim ve ne zaman tutulur; her kaldırma ve geri alma denetim kaydına yazılır (`google_review`). Yorum Google'da ve Google'ın puanında kalır. Moderasyon yok (adr/0058 §7).
- **Yanıt (panelden, adr/0058 Ek 2026-11-06):** yoruma tıkla → "Yanıtınız" → "Yanıtla" / "Yanıtı güncelle" / "Yanıtı sil". Google'a `PUT`/`DELETE /v4/{accounts/*/locations/*/reviews/*}/reply` ile yazılır (düz metin, en çok 4096 bayt), sonra Google'ın yanıtladığı hâliyle tutulur; yerel kayıt düşerse Google'daki önceki yanıt geri yazılır. Google'ın moderasyonu (`reply_state`) panelde görünür; vitrin yalnız onaylı (ya da durumsuz) yanıtı "Mağazanın yanıtı" olarak çizer. Google'da doğrudan yazılan yanıt eşitlemeyle gelir. Her yanıt denetim kaydına yazılır (metni değil, uzunluğu ve durumu).
- **Ana sayfa rozeti:** tema düzenleyicide "Google puanı" bölümü: ortalama, sayı, `/yorumlar` ve Google bağlantısı, isteğe bağlı 1–3 son 4–5 yıldızlı alıntı. Bağlı değilken ya da yorum yokken çizilmez.
- **Kaldırma:** "Bağlantıyı kaldır" konumu ve yorumları siler (Google bağlantısı kalır). Google bağlantısı kesilirse yorumlar da silinir.
- **SEO:** Google yorumları hiçbir JSON-LD'ye girmez (docs/13 §5, Google'ın review snippet kuralları).
- **Loglar (operatör için):** `google_reviews.reply_failed` (error: proje onaysız `RESOURCE_EXHAUSTED`/`http_429`; warn: mağazanın ret sebepleri), `google_reviews.reply_restore_failed` (error), `google_reviews.sync_failed` (error: API kapalı, proje onaysız, Google'a ulaşılamıyor; warn: mağazanın onaracağı `invalid_grant`, `reviews_scope`), `google_reviews.stale_purged` (error), `google_reviews.synced` (info).
- **`/yorumlar` karışık liste (adr/0058 Ek 2026-11-27):** mağaza yorumları ve Google yorumları tek listede, tarihe göre, aynı kartta; Google kartında ürün yerine "Google'da gör" bağlantısı. Bağlantı yorumun kendisine gider: Google'ın cevabındaki (belgelenmemiş) `reviewReplyUrl`'den alınan Maps kimliği (`maps_review_id`) + konumun `mapsUri`'sindeki `cid`. Bunlar yoksa konumun Maps sayfasına. Google puanı ayrı kutuda, mağaza puanına katılmaz.

## Geliştirmede (sahte Google)

```
pnpm dev:google
```

Backend `.env`'e (yerelde, sahibin eklemesi):

```
GOOGLE_BASE_URL=http://127.0.0.1:9109
GOOGLE_OAUTH_CLIENT_ID=gelistirme-google-istemcisi.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=gelistirme-google-sirri
```

- Sahte sunucu tarayıcıda Google'ın onay ekranını gösterir, Merchant API, Search Console ve Business Profile'ı yanıtlar; bir bıçak atölyesinin 16 yorumu vardır. Ad ve şehir `FAKE_GOOGLE_BUSINESS_NAME`, `FAKE_GOOGLE_BUSINESS_CITY`; bağlanan hesap `FAKE_GOOGLE_EMAIL`; Merchant Center hesap kimliği sabit `5432109876` (`FAKE_GOOGLE_MERCHANT_ID`; sunucu açılışta yazar, Merchant API `accounts.list` ile de listelenir); port `FAKE_GOOGLE_PORT`.
- Yerelde backend `.env`'inde `BACKEND_URL` olmamalı: varsa Google panel yerine 9000'e döner (davet bağlantıları gibi, `panelUrl()`).
- Token'lar `qticaret-local-providers/google-9109.json` dosyasında (işletim sisteminin geçici klasörü) yeniden başlatmalar arasında kalır.
- `GOOGLE_BASE_URL` development ve test dışında reddedilir.
