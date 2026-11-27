# ADR-0058: Google yorumları: Business Profile API

- **Durum:** Kabul edildi (2026-11-05, sahip: "google yorumları entegrasyonuna başla"; ana oturumun önerisi: Google'ın resmî Business Profile API'si, kazıma ve Places API değil)
- **Tarih:** 2026-11-05
- **İlgili:** adr/0038 §5 ve M13/M15 notları (Google bağlantısı), adr/0037 §4 (kendi ürün yorumlarımız), adr/0027 (sağlayıcı hesapları), adr/0046 (tema sözleşmesi), adr/0040 (roller), docs/13 §5 (JSON-LD), `docs/kvkk-envanter.md`, `docs/entegrasyonlar/google-business-profile.md`

## Bağlam

- Sahip (2026-11-05): "yorumlarda google yorumlarını da entegre etmek istiyorum; mylarte'de bunu outscraper ile scraping yöntemiyle çekiyorduk (kendi yorumlarımızı), API'si ücretli diye."
- Mağazanın kendi işletme profilindeki Google yorumları vitrinde güven sinyalidir; ürün yorumlarımızdan (adr/0037) ayrı bir kaynaktır.
- Seçenekler:
  - Kazıma (Outscraper vb.): Google'ın hizmet şartlarına aykırı, kırılgan, ücretli üçüncü taraf.
  - Places API (Place Details `reviews`): en çok 5 yorum, ücretli SKU, içerik saklanamaz (yalnız `place_id`).
  - Business Profile API: profilin sahibi ya da yöneticisi olan hesapla, yorumların tamamı, ortalama ve sayı; çağrı başına ücret bilinmiyor. Ön koşul: platformun Google Cloud projesi için Google'ın "Basic API Access" onayı ve doğrulanmış işletme profili.
- Platformun tek Google OAuth istemcisi ve mağazanın Google bağlantısı zaten var (Merchant Center, Search Console; adr/0038 §5). Search Console kapsamı sonradan eklenmiş, eski bağlantılar yeniden onayla tamamlanmıştı (M15).

## Karar

1. **Kaynak resmî API'lerdir** (referanslardan doğrulandı, 2026-11-05):
   - My Business Account Management API v1: `GET /v1/accounts` (sayfa 20).
   - My Business Business Information API v1: `GET /v1/{accounts/*}/locations?readMask=name,title,storefrontAddress,metadata` (`readMask` zorunlu, sayfa en çok 100). Konum adı `locations/{id}`; bağlantılar `metadata.mapsUri` (Haritalar'daki yer) ve `metadata.newReviewUri` (yorum yazma sayfası).
   - Google My Business API v4: `GET /v4/{accounts/*/locations/*}/reviews` (sayfa en çok 50, `pageToken`); yanıt `reviews[]`, `averageRating`, `totalReviewCount`, `nextPageToken`. `Review`: `reviewId`, `reviewer {displayName, profilePhotoUrl, isAnonymous}`, `starRating` (`ONE`…`FIVE`), `comment`, `createTime`, `updateTime`, `reviewReply {comment, updateTime, reviewReplyState}`.
   - Kapsam: `https://www.googleapis.com/auth/business.manage`. Kazıma ve Places API kullanılmaz.
2. **Bağlantı mağazanın Google bağlantısıdır** (adr/0038 §5): aynı istemci, aynı yenileme token'ı (`integration-credentials`, `google`; adr/0027).
   - `business.manage` herkesin bağlantısında istenmez: hassas, geniş yazma yetkili bir kapsamdır ve işletme profili olmayan mağaza için anlamsızdır. Yalnız "Google yorumlarını bağla" (`POST /admin/google/reviews/connect`) onu olağan kapsamların üstüne ister; `include_granted_scopes=true` ile yeni token önce verilenleri de taşır (artımlı yetkilendirme).
   - O akışın `state`'i `r.` önekiyle başlar (base64url'de nokta yok; özet öneki de kapsar). Geri dönüş `/reviews/google?google=<sonuç>`'a gider; öteki akışlar `/settings/marketing`'e (değişmedi).
   - Bağlanınca tek konum varsa ve henüz seçilmemişse o seçilir ve hemen okunur (başarısızlık bağlantıyı bozmaz, panel seçtirir).
   - Verilen kapsamlar hesap ayarlarındaki `scopes`'tan okunur. Kapsamsız bağlantıya panel "Google yorumlarını bağla" der; uç `google.reviews_scope` döndürür.
3. **Konum seçimi:** hesapların konumları listelenir (en çok 20 hesap; aynı konum birden çok hesaptan gelirse ilki). Seçim (`POST /admin/google/reviews/location`) Google'ın o anki listesiyle denetlenir (`google.location_invalid`). Başka bir konum seçilince saklanan yorumlar silinir.
4. **Saklama: `google-reviews` modülü.**
   - `google_review_location` (en çok bir satır): hesap ve konum adı, başlık, adres satırı, `maps_uri`, `new_review_uri`, Google'ın `average_rating` ve `total_review_count`'u, `synced_at`, `sync_error`.
   - `google_review`: Google'ın `review_id`'si (benzersiz), yorumcunun adı ve fotoğrafı (Google'ın gösterdiği gibi), yıldız 1–5, metin, yazılma ve değişme zamanı, sahibin yanıtı ve zamanı, `hidden` ile `hidden_reason`, `hidden_by`, `hidden_at` (madde 7).
   - Anonim yorumcunun adı ve fotoğrafı tutulmaz. Sahibin yanıtı yalnız Google onu gösteriyorsa tutulur (`reviewReplyState` yok ya da `APPROVED`; `PENDING`/`REJECTED` değil).
   - Fotoğraf yalnız https ve Google'ın kendi alanlarından (`*.googleusercontent.com`, `*.ggpht.com`); bağlantılar yalnız https ve Google alanlarından. Metin 5000 karakterle sınırlı. Yıldızsız ya da tarihsiz yorum atlanır.
5. **Eşitleme:**
   - Günlük iş `google-reviews-sync` (04:20 UTC), konum seçilince bir kez, panelde "Şimdi eşitle".
   - Bütün sayfalar okunur (en çok 100 × 50). Yeni yorum eklenir, değişen güncellenir (`hidden` korunur). Hepsi okunduysa Google'ın artık vermedikleri silinir; sınır aşılırsa hiçbir şey silinmez.
   - Ortalama ve sayı Google'ındır; ilk sayfadan alınır, hiçbir yerde hesaplanmaz.
   - HTTP istemcisi (`lib/clients`) zaman aşımı, yeniden deneme ve 429/503'te `Retry-After` ile bekler. Duran eşitlemede saklanan kalır, sebep `sync_error`'a yazılır.
   - Loglar: `google_reviews.synced` (info, sayılarla); `google_reviews.sync_failed` mağazanın onarabileceği sebepte (`invalid_grant`, `reviews_scope`, `not_connected`) warn, öteki her sebepte error (API açık değil, proje onaysız: `http_429`, Google'a ulaşılamıyor). Operatör error'ı izler.
   - Aynı anda iki eşitleme (iş ve panel) veritabanı kilidiyle sıraya girer (`pg_advisory_xact_lock`). Eşitleme sürerken konum değişirse yazılmaz.
6. **Google'ın 30 gün kuralı** (Business Profile API politikaları: saklanan içerik geçici, en çok 30 takvim günü, güvenli ve "manipulated or aggregated" değil):
   - Her başarılı eşitleme hepsini yeniden okur. Son başarılı eşitleme 30 günden eskiyse günlük iş yorumları, ortalamayı ve sayıyı siler (konum seçimi kalır); log `google_reviews.stale_purged` (error). Vitrin 30 günden eski içeriği zaten göstermez.
   - Google'ın puanı bizim yorumlarımızla birleştirilmez, değiştirilmez.
7. **Vitrinden kaldırma yalnız üç gerekçeyle (moderasyon yok; Ek 2026-11-05, sahip: "tamam gizlemeyi önerdiğin gibi yap"):** yorumlar Google'ındır, burada düzenlenmez.
   - Mağaza bir yorumu vitrinden yalnız şu gerekçelerden biriyle kaldırabilir: `personal_data` ("Kişisel veri içeriyor"), `abusive` ("Hakaret, küfür ya da nefret söylemi"), `off_topic` ("Konu dışı ya da spam"). Serbest gerekçe yok; gerekçesiz istek 400 `google.hide_reason_required`, listede olmayan 400 `google.hide_reason_invalid`, geri almada gerekçe 400 `google.hide_reason_unexpected`.
   - `POST /admin/google/reviews/items/:id { hidden: true, reason }`; tutulan: `hidden_reason`, `hidden_by` (personel), `hidden_at`. Geri alma (`{ hidden: false }`) üçünü de temizler. Eşitleme bunlara dokunmaz.
   - Yıldıza göre kaldırma yok: toplu uç, süz-ve-kaldır, yıldız kuralı yok. Uç tek yorum alır (`.strict()`, kimlik listesi 400); listenin kendisine POST yolu yok (404).
   - Her kaldırma ve geri alma denetim kaydına yazılır: kaynak `google_review`, önce ve sonra (`hidden`, `hidden_reason`, `hidden_by`, `hidden_at`), gerekçe dahil (`api/http/audit/resources/google-reviews.ts`).
   - Vitrindeki ortalama ve sayı her zaman Google'ındır; kaldırma onları değiştirmez, kaldırılan yorum yalnız kartlardan çıkar. "Google'da tümünü gör" Google'a gider.
   - `operations` rolü de yapabilir (moderasyon gibi).
   - Gerekçe: olumsuz yorumların seçici gizlenmesi tüketiciyi yanıltan ticari uygulama sayılabilir (tüketici mevzuatı) ve Business Profile API politikası içeriğin "manipulated" edilmesini yasaklar; puan Google'ın kalır, yorum yalnız kişisel veri, hakaret ya da konu dışı olduğu için çıkar. **Gözden geçir:** kural yine de bir avukatın bakışını hak ediyor (şirket ve danışman yok, işaretli kalır).
8. **Kaldırma:**
   - "Bağlantıyı kaldır" (Yorumlar > Google yorumları, `DELETE /admin/google/reviews`): konum ve bütün yorumlar silinir; Google bağlantısı (Merchant Center, Search Console) kalır.
   - Google bağlantısı kesilince (`DELETE /admin/google`, sahibin) yorumlar da silinir (iş akışının son adımı).
9. **Vitrin (`GET /store/google-reviews?limit=`, 1–20, varsayılan 6; `Cache-Control: public, max-age=300`):** başlık, Google'ın ortalaması (bir ondalık), sayısı, Haritalar ve yorum yazma bağlantıları, en yeni gizlenmemiş yorumlar (yanıtıyla). Konum yokken, hiç eşitlenmemişken, içerik 30 günden eskiyken ya da gösterilecek bir şey yokken `null`.
10. **Tema sözleşmesi (isteğe bağlı alan):** `ReviewsPageView.google?: GoogleReviewsView | null` (`average`, `rating`, `count`, `label`, `allUrl`, `writeUrl`, `reviews: GoogleReviewView[]`). `/yorumlar`'ın yalnız ilk sayfasında, kendi yorumlarımızdan sonra ayrı bölüm.
    - Atölye: "Google yorumları" başlığı, büyük ortalama, yıldızlar, "Google · N yorum", "Google'da tümünü gör" (yeni sekme, `rel="noopener noreferrer"`); üç sütun kart: fotoğraf (yoksa adın baş harfi), ad, tarih, yıldızlar, metin, kuyuda "İşletmenin yanıtı"; altta kaynak satırı ve "Google'da yorum yazın". Fotoğraf `referrerpolicy="no-referrer"`.
    - Base: düz liste ve aynı bağlantı.
    - Google logosu çizilmez (marka izni gerektirir); kaynak "Google" sözcüğüyle ve kaynak satırıyla belirtilir.
11. **SEO:** Google yorumları hiçbir yapılandırılmış veriye girmez: ne `Product` ne `OnlineStore` (`aggregateRating`, `review`). Gerekçe Google'ın review snippet kuralları: "Don't aggregate reviews or ratings from other websites"; işletmenin kendi kontrol ettiği yorumlar `LocalBusiness`/`Organization` yıldızına uygun değil. `jsonld.ts` yalnız `product-reviews`'un onaylı yorumlarını okur; test `integration-tests/http/google-reviews.spec.ts` (ürün ve site blokları Google yorumları varken `aggregateRating`/`review` taşımaz) ve vitrinde `google-reviews-theme.spec.ts` (blokta `ld+json` ve `itemprop` yok).
12. **Panel:** Yorumlar > Google yorumları (`/reviews/google`); platformun Google istemcisi yoksa sekme yok, adres açılırsa tek satır bilgi (docs/06 ilke 10).
    - Kart: bağla ya da yeniden bağla, konum seçimi (tek konum hazır seçili), tek satır durum ("Google'da 4,6 · 16 yorum · son eşitleme 2 saat önce"), sebebe göre tek satır uyarı (yeniden bağla / konumu yeniden seç / ertesi gün denenir), "Konumu değiştir", "Şimdi eşitle", "Bağlantıyı kaldır" (onaylı).
    - Liste: en yeniden 20'şer; yıldız, "Yanıtlandı", metin ya da "Yalnızca puan verilmiş", ad ve tarih. Satır başına "Vitrinden kaldır": küçük pencerede üç gerekçe radyo satırı (hiçbiri seçili değil, seçmeden onay kapalı) ve tek satır not "Olumsuz yorumlar puanı nedeniyle kaldırılamaz; yalnızca bu üç gerekçeyle kaldırabilirsiniz." Kaldırılmış satırda "Vitrinden kaldırıldı", gerekçe, kim ve ne zaman, "Vitrine geri al". Toplu seçim yok.
    - Yetki: `POST /admin/google/reviews/connect` sahibin (bağlanma, adr/0040); konum, eşitleme ve kaldırma `admin`'in; gizleme `operations`'ın da.
    - Konumlar ve eşitleme panel çağrıları Google sınırıyla (`provider_check`) sınırlıdır; Business Profile kotası platform projesinindir (bütün mağazalar paylaşır).
13. **Sahte Google (`packages/testing/src/google`):** OAuth akışı ayrı dosyada (`oauth-flow.ts`; `include_granted_scopes` birleşimi, iptal bütün izinleri bitirir, durum dosyası), tarayıcıda Google'ın onay ekranı (`consent-page.ts`; kapsamlar işaret kutusu), Search Console ayrı dosyada, Business Profile'ın üç ucu (`business-profile.ts`; kapsam yoksa 403, onaysız proje 429 `RESOURCE_EXHAUSTED`) ve bir bıçak atölyesinin 16 Türkçe yorumu (`business-data.ts`; çoğu beş yıldız, metinsiz, anonim, yanıtlı olanlar; yorumcu fotoğrafları sahtenin kendi adresinden). Geliştirme: `pnpm dev:google` (9109), `GOOGLE_BASE_URL` yalnız development ve test'te kabul edilir (mevcut kural).

## Alternatifler

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **Business Profile API (seçilen)** | Resmî; bütün yorumlar, ortalama ve sayı; mağazanın kendi verisi kendi izniyle; çağrı ücreti yok | Google'ın erişim onayı (proje başına bir kez), hassas kapsam için uygulama doğrulaması, doğrulanmış profil (60+ gün), 30 gün saklama kuralı |
| Kazıma (Outscraper vb.) | Onay gerekmez | Google'ın şartlarına aykırı; ücretli üçüncü taraf; kırılgan; kişisel veri dolaylı yoldan |
| Places API (Place Details) | Onay gerekmez, kurulum kolay | En çok 5 yorum; ücretli SKU; içerik saklanamaz, her gösterimde çağrı |
| Yorumları elle girmek | Bağımlılık yok | Doğrulanamaz, güncel kalmaz, Google'ın sözü değil |

## Sonuçlar

- Yeni modül ve migration: `google-reviews` (`Migration20261105144414`, `google_review`, `google_review_location`; anlık görüntü `db:generate`'le test veritabanında üretildi). Kaldırma gerekçesinin üç sütunu (Ek) henüz hiçbir yerde uygulanmamış bu migration'a katıldı; anlık görüntü yeniden üretildi.
- Yeni ortam değişkeni yok: istemci `GOOGLE_OAUTH_CLIENT_ID/SECRET`, sahte için `GOOGLE_BASE_URL` (yalnız development/test).
- Dış iş (kod dışı, docs/12): API erişim başvurusu, üç API'nin açılması, onay ekranında `business.manage`'in doğrulanması. Onay gelmeden bağlanan mağazada eşitleme `http_429` ile durur ve error log'a düşer; panel "ertesi gün denenir" der.
- Testler: `src/lib/google/__tests__/business-review.unit.spec.ts`, `integration-tests/http/google-reviews.spec.ts` (bağlanma, yeniden onay, eşitleme farkı, gizleme, ret, 30 gün, konum değişimi, kaldırma, JSON-LD), `integration-tests/http/google-reviews-hiding.spec.ts` (gerekçesiz ve listede olmayan gerekçe 400, toplu istek reddi, gerekçeyle kaldırma, denetim kaydı, geri alma, Google'ın puanı değişmez), panel `google-reviews-page.spec.tsx` (gerekçe penceresi), vitrin `google-reviews-theme.spec.ts`.
- Yapılmayan: ana sayfanın güven şeridinde ya da yorumlar bölümünde Google rozeti (sözleşmeye eklenmedi; tema onay adımıyla ayrı iş). Sahibin Google'da yanıt yazması (API destekler, kapsam içinde değil). İkisi Ek 2026-11-06 ile yapıldı.

## Ek (2026-11-06): ana sayfanın Google puanı ve panelden yanıt (otonom, gözden geçir)

İstek: ana sayfada Google ortalaması ve sayısıyla küçük bir rozet bölümü; panelin Google yorumları ekranından yoruma yanıt. Yukarıdaki "Yapılmayan" maddesinin ikisi de bu ekle yapıldı.

**A. Ana sayfa bölümü `google_rating`** (adr/0049'un bölüm düzeni; şema `lib/storefront/layout-google.ts`, yalnız ana sayfa):
- Ayarlar: `title` (isteğe bağlı, 60; boşsa vitrin "Google'da bizi değerlendirenler"), `excerpts` 0–3 (varsayılan 0: kapalı; panelde anahtar açılınca 2), `profile_link` (varsayılan açık: Haritalar'daki yer). Başka alan yok (`.strict()`): puan, sayı, yorum belgeye yazılmaz.
- Düzen okuması yalnız ayarları verir (`/store/storefront-layout`); rakamları ve alıntıları vitrin her istekte `GET /store/google-reviews?limit=<excerpts>&min_rating=4` ile alır (öteki yorum bölümleri gibi; düzenin bir dakikalık önbelleğine girmez). `limit` artık 0 olabilir (yalnız rakamlar); `min_rating` (1–5) verilince yalnız en az o kadar yıldızlı **ve metni olan** gizlenmemiş yorumlar gelir.
- Bağlı değilken, eşitleme yokken, içerik 30 günden eskiyken, ortalama ya da yorum yokken bölüm vitrinde **hiç çizilmez** (boş kutu yok). Gizlenen yorum hiçbir zaman alıntı olmaz.
- Tema sözleşmesi `GoogleRatingSectionView` (`average` "4,6", `rating`, `label`, `reviews` → `/yorumlar` "Google'da N değerlendirme", `profileUrl` yalnız https, `excerpts[]`). Atölye `sections/GoogleRating.tsx`: açık, sıkı; dolgu kuyuda büyük ortalama, yıldızlar, "Google" sözcüğü, iki sessiz hap bağlantı; yanında (telefonda altında) alıntı kartları (yıldız, ilk cümle, ad, tarih). Alıntı yoksa kuyu tam genişlik. Base düz liste. Google logosu yok.
- **Yapılandırılmış veri yok.** Google'ın review snippet kuralları, işletmenin kendi sitesinde kendisi hakkındaki yorumlarla `LocalBusiness`/`Organization` yıldızını ("self-serving reviews") ve başka sitelerden toplanmış puanı yasaklar. Bu yüzden rozet `aggregateRating`/`Review` JSON-LD'si, `itemprop` ya da microdata taşımaz; madde 11 aynen geçerli. Test: `google-rating-theme.spec.ts` (`ld+json`, `itemprop` yok).

**B. Panelden yanıt** (Business Profile API v4, referanstan doğrulandı 2026-11-06):
- `PUT https://mybusiness.googleapis.com/v4/{accounts/*/locations/*/reviews/*}/reply`, gövde `ReviewReply { comment }` (düz metin, **en çok 4096 bayt**), yanıt `ReviewReply { comment, updateTime, reviewReplyState }` (`PENDING` | `APPROVED` | `REJECTED`); yanıt yoksa oluşturur, varsa değiştirir. `DELETE` aynı yol, gövdesiz, yanıt `{}`. İkisi de `business.manage` ve doğrulanmış konum ister. İstemci `lib/google/business-reply.ts` (yol parçaları tek tek kodlanır, inceleme kimliği denetlenir).
- Uçlar: `POST /admin/google/reviews/items/:id/reply { comment }`, `DELETE /admin/google/reviews/items/:id/reply`. Gövde `.strict()`; boş 400 `google.reply_required`, 4096 bayt üstü 400 `google.reply_too_long` (Türkçe harf iki bayt; sınır karakter değil bayt), denetim karakteri 400 `google.reply_invalid`; yanıtı olmayanı silmek 400 `google.reply_missing`. Hız sınırı `provider_check` (Google kotası platformun). Yetki: `admin` ve `operations` (ürün sorusunu yanıtlamak gibi).
- İş akışı `google-reviews-reply` (`workflows/google/reviews-reply.ts`): önce Google'a yazar, sonra Google'ın yanıtladığı hâliyle yerelde tutar (`reply`, `replied_at`, yeni `reply_state`). **Telafi:** yerel kayıt düşerse Google'a önceki yanıt geri yazılır (önceden yanıt yoksa yeni yanıt silinir; silme işleminde eski metin geri yazılır); log `google_reviews.reply_restored` (warn) ya da `google_reviews.reply_restore_failed` (error; bir sonraki eşitleme Google'daki hâli getirir).
- Google'ın reddi mağazanın sözüyle (400): `PERMISSION_DENIED` → `google.reply_forbidden`, `FAILED_PRECONDITION` → `google.reply_unverified`, `INVALID_ARGUMENT` → `google.reply_refused`, `NOT_FOUND` → `google.review_not_found`, `RESOURCE_EXHAUSTED`/`http_429`/`UNAVAILABLE`/`http_503` → `google.reply_unavailable`. Proje onaysız (0 QPM, `RESOURCE_EXHAUSTED`/`http_429`) error, ötekiler warn log (`google_reviews.reply_failed`). Ret durumunda hiçbir şey yazılmaz, geri alınacak bir şey yoktur.
- Denetim kaydı: kaynak `google_review`, eylem `POST|DELETE /admin/google/reviews/items/:id/reply`; önce/sonra `replied`, `reply_length`, `replied_at`, `reply_state`. Yanıtın metni denetim kaydına yazılmaz (Google'da ve vitrinde zaten görünür; yanıt müşterinin adını içerebilir).
- **Madde 4'ün değişikliği:** sahibin yanıtı artık her durumda tutulur, Google'ın moderasyonuyla birlikte (`reply_state`: `pending`/`approved`/`rejected`, durum yoksa `null`). Vitrin yalnız Google'ın gösterdiğini çizer (`approved` ya da `null`); panel bekleyen ve yayımlanmayanı mağazaya gösterir ("Google onayında", "Google yayımlamadı"). Eşitleme Google'da doğrudan yazılan ya da değiştirilen yanıtı da getirir (değişiklik sayılır). Migration `Migration20261106203947` (`google_review.reply_state`, null olabilir).
- Panel (Yorumlar > Google yorumları): satıra tıkla → standart `FormDialog` (yorumun tamamı, "Yanıtınız" alanı, Google'ın saydığı gibi bayt sayacı "N / 4096 bayt", "Yanıtla" / "Yanıtı güncelle", solda "Yanıtı sil" (sorar); altında "Vitrinde": gerekçeli kaldırma ya da geri alma). Satırdaki ayrı "Vitrinden kaldır" düğmesi pencereye taşındı (tek giriş). `FormDialog` isteğe bağlı `submitLabel`, `canSubmit`, `footerStart` aldı.
- Vitrin: `/yorumlar`'daki yanıtın etiketi "Mağazanın yanıtı" (önce "İşletmenin yanıtı").
- Sahte Google: `PUT`/`DELETE .../reply` (`replyCalls`, `replyState`, `replyRefusal`; kapsam yoksa 403, onaysız 429).
- Kanıt: `lib/storefront/__tests__/layout-google.unit.spec.ts`, `workflows/google/__tests__/reviews-reply.unit.spec.ts` (telafi dahil), `lib/google/__tests__/business-review.unit.spec.ts`, `integration-tests/http/google-reviews-reply.spec.ts` (yaz, güncelle, sil, denetim, bekleyen yanıt, Google'dan gelen yanıt, ret ve bayt sınırı, rozet uçları, düzen çıktısı); panel `google-review-dialog.spec.tsx`, `google-reviews-page.spec.tsx`, `google-rating-form.spec.tsx`; vitrin `google-rating-theme.spec.ts`, `google-reviews-theme.spec.ts`.
- Sahibin yapacağı yok: Google erişimi onaylanana kadar yanıt `google.reply_unavailable` ile döner ve hiçbir şey değişmez; onay gelince ek bir adım gerekmez.

## Ek (2026-11-27): `/yorumlar`'da karışık liste ve yorum başına Google bağlantısı (sahip isteği)

- **Karışık liste.** `/yorumlar` sayfası mağazanın kendi yorumlarını ve Google yorumlarını tek listede, tarihe göre (en yeni üstte; aynı anda mağazanınki önce) aynı kart tasarımıyla gösterir. Kendi yorumun kartında değerlendirilen ürün nerede duruyorsa Google yorumunun kartında orada Google işareti, "Google yorumu" ve yorumun kendisine giden "Google'da gör" bağlantısı (yeni sekme, `noopener noreferrer`) durur. Sayfalama birleşik listeyi keser: `GET /store/reviews?google=1` mağazanın ve Google'ın yalnız kimlik + tarihlerini okur, sayfanın penceresini hesaplar, yalnız o sayfanın satırlarını tam okur; `count` ikisinin toplamıdır.
- **Puanlar ayrı kalır.** Google'ın ortalaması ve sayısı mağazanın özetinin altında ayrı bir kutuda ("Google yorumları", Google'da tümünü gör / yorum yaz) gösterilir, mağaza puanına katılmaz. Yıldız filtresi (`?puan=`) ve dağılım yalnız mağazanındır: filtreli sayfada Google yorumu yoktur. Google yorumları hiçbir yapılandırılmış veriye girmez.
- **Yorum başına bağlantı.** v4 `Review.reviewId` şifreli bir kimliktir (`AbFvOq…`) ve Maps bağlantısında kullanılamaz. Google'ın canlı cevapları belgede yazmayan `reviewReplyUrl` alanını da taşır: `https://business.google.com/n/{konum}/reviews/{mapsId}`; buradaki `mapsId` (`Ci9DQUlRQUNv…EAE`) Maps'in yorumu adlandırdığı kimliğin ta kendisidir. Eşitlemede bu kimlik `google_review.maps_review_id` sütununa yazılır; bağlantı okunurken konumun `metadata.mapsUri`'sindeki `cid` (onlu → onaltılı) ile kurulur: `https://www.google.com/maps/reviews/data=!4m6!14m5!1m4!2m3!1s{mapsId}!2m1!1s0x0:0x{cid}?hl=tr` (Places API'nin `Review.googleMapsUri` biçimi). Google alanı vermezse ya da `cid` okunamazsa kart konumun Maps sayfasına bağlanır. Alan belgede olmadığından Google onu kaldırabilir; o zaman bağlantı kendiliğinden konum sayfasına düşer.
- **Ana sayfa bölümleri değişmedi.** Yayımlanmış `reviews` (ızgara/kaydırmalı) ve `google_rating` bölümlerinin çizimi aynı kalır (adr/0066). Ana sayfada karışık liste istenirse `reviews` bölümüne varsayılanı kapalı bir ayar olarak eklenir.
