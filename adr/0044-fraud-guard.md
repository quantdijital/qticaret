# ADR-0044: Dolandırıcılık koruması (fraud-guard)

- **Durum:** Kabul edildi (2026-10-31, kullanıcı tek tek gözden geçirip onayladı; "Güvenlik incelemesi"ndeki kalan 5 risk kabul, sonraki fazlarda kapatılır). Ek 2026-11-24: Cloudflare Turnstile riskli kapılarda, iş kanıtı yedeği.
- **Tarih:** 2026-10-31
- **İlgili:** docs/04 (dolandırıcılık, SMS pumping); ADR-0036 §8 (SMS kotası, `challenge` işareti); ADR-0037 M9 (ödemede IP sayacı); ADR-0026 (barındırılan ödeme formu); ADR-0040 (roller)

## Bağlam

F15.6 dört şey ister:

- giriş, kayıt ve ödemede bot doğrulaması (captcha);
- kart, IP ve e-posta için hız (velocity) kuralları;
- şüpheli sipariş işareti ve panelde inceleme kuyruğu;
- kara liste.

KK: "Velocity kuralını aşan checkout engelleniyor veya incelemeye düşüyor (testli)."

Kısıtlar:

- **Dış servis yok.** reCAPTCHA, hCaptcha ve Turnstile ziyaretçi verisini yurt dışına taşır; KVKK açık rıza ve yurt dışı aktarım sorunu doğurur. F15 planı dış servisi kullanıcı onayına bağlar.
- **Kart verisi bizde yok.** Ödeme formu sağlayıcıda (SAQ-A). Kartın parmak izi en erken ödemeden sonra sağlayıcı yanıtında gelir.
- **Ziyaretçinin IP'si saklanmaz.** Yalnızca `PII_HASH_KEY` ile anahtarlanmış kova kullanılır (`clientBucket`, ADR-0037 M9).
- Mevcut parçalar:
  - `smsAllowance` aşırı istekte `challenge: true` döndürüyor ama soracak bir doğrulama yok;
  - `/store/carts/:id/complete` üzerinde IP sayan bir ara katman var (`checkout-sms.ts`);
  - `completeCartWorkflow.hooks.validate` ödeme kurallarının yeri.

## Karar

`fraud-guard` adında bir modül ve onun yanında ince ara katmanlar kurulur. Dört parçası var.

### 1. İş kanıtı doğrulaması (kendi barındırdığımız captcha)

Görsel bulmaca yok. Tarayıcı küçük bir hesap yapar; insan fark etmez, toplu istek yapan bot için pahalıdır (ALTCHA ve Friendly Captcha'nın yöntemi). Kod: `lib/security/challenge`, `api/http/challenge.ts`.

- **Uyarlanır:** Doğrulama her istekte istenmez. Kapsamın sayacı eşiği aşınca uç 428 `fraud.challenge_required` döner. Gövdede bir meydan okuma vardır: `{ token, salt, bits, expires_at }`. Ayrı bir "meydan okuma al" ucu yok.
  - `token`, sunucunun anahtarlı özetiyle (`PII_HASH_KEY`) imzalı durumsuz bir kayıttır: kapsam, tuz, zorluk, bitiş. Veritabanına yazılmaz. Ömrü 5 dakika.
- **Çözüm:** İstemci `SHA-256(salt + nonce)` değerinin ilk `bits` biti sıfır olan `nonce`'u bulur. Aynı istek `X-Challenge: <token>.<nonce>` başlığıyla tekrarlanır.
- **Doğrulama:** İmza, kapsam, süre ve özet kontrol edilir. Çözüm tek kullanımlıktır: tuzu, paylaşılan sayaç deposunda süresi bitene kadar tutulur.
- **Kapsamlar ve eşikler:**

| Kapsam | Uç | Eşik |
|---|---|---|
| `register` | `POST /auth/customer/emailpass/register` | IP başına saatte 3 kayıt |
| `login` | `POST /auth/customer/emailpass`, `POST /auth/user/emailpass` (personel, 2026-10-31) | Aynı e-postaya (her yerden) 15 dakikada 5'ten fazla deneme; her deneme çalışmadan önce sayılır (aynı anda gönderilenler eşiği atlayamaz); yalnızca doğrulama ister, kilitlemez |
| `order_lookup` | `POST /store/order-lookup` | IP başına saatte 5 |
| `stock_alert` | `POST /store/stock-alerts` | IP başına saatte 5 |
| `checkout` | `POST /store/carts/:id/payment-session` | §2'deki hız kuralları |

- Zorluk 18 bit: ortalama ~260 bin özet, telefonda 1 saniyenin altında. Sayaç eşiğin iki katını aşınca 20 bit.
- Sert sınırlar hız sınırlayıcınındır (`RATE_LIMIT_PROFILES`). Doğrulama ondan önce gelir.
- IP başına eşikler entegrasyon testlerinde hız sınırları gibi büyür (`perIpScale`). `fraud-guard.spec` gerçek değerlerle sınar.
- Yorum ve soru doğrulanmış hesap ister, hız sınırına tabidir; doğrulama istenmez. Personel girişi 2FA ile korunur; F15 denetiminden sonra (2026-10-31) müşteri girişiyle aynı eşikte doğrulama da ister, panel çözücüyü içerir (`apps/panel/src/lib/challenge.ts`). ADR-0036 §8'deki SMS `challenge` işareti, vitrinin ilk SMS ucu (F18) yazılınca bu düzene bağlanır.
- Erişilebilirlik: kullanıcıdan hiçbir şey istenmez, ekran okuyucuyla sorun yok.

### 2. Hız kuralları (ödeme)

Sayım ödemenin başladığı yerde yapılır: `POST /store/carts/:id/payment-session` (`api/http/checkout-guard.ts`). Her ödeme yolu buradan geçer. Kartla ödemede sipariş sağlayıcının bildirimiyle açılır, `/complete` hiç çağrılmaz (güvenlik incelemesi 2026-10-31, yüksek bulgu). Sayaçlar paylaşılan hız sınırı deposundadır; IP kovası, e-postanın ve telefonun anahtarlı özetiyle tutulur.

| Anahtar | Doğrulama ister | Engeller |
|---|---|---|
| IP kovası başına ödeme başlatma / saat | 5'ten sonra | 30'dan sonra |
| E-posta başına ödeme başlatma / saat | 3'ten sonra | Engellemez |
| IP kovası başına farklı e-posta / gün | 3'ten sonra | 30'dan sonra |

- **Bir IP binlerce kişinin olabilir.** Mobil operatörler çok sayıda müşteriyi tek adresin arkasına koyar (CGNAT). Bu yüzden IP sınırlarında engel uzak tutulur, doğrulama yakın.
- **E-posta herkesin yazabileceği bir değerdir.** Misafir sepetine başkasının adresini yazan, o kişiyi ödemeden kilitleyemesin diye e-posta sınırı yalnızca doğrulama ister.
- Engelleme 429 `fraud.velocity`, doğrulama 428 döner. Metinler geneldir.
- Sayılanlar (adresin ve telefonun kullandığı farklı e-posta sayısı, yalnızca sayı) sepete `qt_fraud_signals` olarak yazılır. `qt_` önekli üst veri alışverişçiye kapalıdır. Siparişin puanı bunları okur.
- `/complete` yeniden saymaz, yalnızca kara listeye bakar.
- Değerler kodda sabittir. Mağazaya açılması gerekirse ayarlara taşınır. Entegrasyon testlerinde hız sınırları gibi büyür (`perIpScale`).
- Sayım ya da not başarısız olursa ödeme geçer ve loglanır: sağlayıcının kendi denetimleri sürer, sipariş kara listeye bir kez daha bakılarak açılır.

### 3. Şüpheli sipariş işareti ve inceleme kuyruğu

`order.placed` sonrasında `fraud-review-order` workflow'u siparişi puanlar (`lib/fraud/score.ts`):

| Kural | Puan |
|---|---|
| Müşterinin ilk siparişi ve tutar mağaza eşiğinin üstünde (varsayılan 5.000 TL) | 30 |
| Teslimat ve fatura ili farklı, ikisi de dolu | 10 |
| Aynı IP kovasından bugün ≥ 5 farklı e-postayla ödeme denemesi | 20 |
| Aynı telefon bu hafta ≥ 3 farklı e-postayla | 25 |
| Tek kullanımlık e-posta alan adı (yerel liste) | 20 |
| Ödemede ≥ 3 başarısız deneme | 20 |

- Puan eşiğe ulaşırsa (varsayılan 50) `fraud_review` kaydı açılır (`pending`; nedenler kural adı ve puan olarak, kişisel veri yok). Zil çalar (`fraud_review`).
- Eşik ve tutar Ayarlar > Güvenlik'tedir (`security` bölümü: `fraud_review_score`, `fraud_high_amount`; yalnızca sahip değiştirir).
- **İnceleme bekleyen ya da reddedilen sipariş kargoya verilemez.** Bu kural "Kargoya ver" workflow'unda (tekli ve toplu) ve Medusa'nın kendi gönderim ucunda (`/admin/orders/:id/fulfillments`) uygulanır: `fraud.review_pending` / `fraud.review_rejected`.
- Panel: Siparişler > İnceleme. Sahip ve yönetici (`fraud` yetkisi) onaylar ya da reddeder. Operasyon ve salt okunur kuyruğu görür.
  - Onaylamak kargoyu açar.
  - Reddetmek siparişi kalıcı olarak kargoya kapatır. İptal ve iade sipariş sayfasındaki olağan iptalle yapılır; para akışı tek yerde kalır (iptal, iadeyi Medusa'nın iptalinden önce kendi akışımızla yapar: `refundBeforeCancel`).
  - Aynı anda iki karar verilirse biri kazanır (koşullu güncelleme), diğeri 409 `fraud.review_decided` alır.
- Karar, admin yazma uçlarının olağan denetim kaydına girer.

### 4. Kara liste

`fraud_block`: tür (`email`, `email_domain`, `phone`, `ip`), eşleşme değeri, görünen değer, neden, ekleyen, isteğe bağlı bitiş tarihi.

- Değer ve istek aynı yazıma getirilir (`lib/fraud/block.ts`):
  - e-posta `+etiket`siz, anahtarlı özetle;
  - alan adı küçük harfle, alt alan adlarını da kapsar;
  - telefon E.164 (Türkiye biçimleri ve yurt dışı `+` ile), anahtarlı özetle; teslimat ve fatura telefonunun ikisi de bakılır;
  - IP, hız sınırlarının saydığı gibi: IPv4'e eşlenmiş IPv6 IPv4 olarak, IPv6 /64 olarak (bir bağlantı bütün /64'ü tutar).
- E-posta ve telefonun ham değeri saklanmaz, panelde maskeli gösterilir.
- IP kişisel veridir: kayıt en çok 1 yıl geçerlidir. Süresi geçen her kayıt gece kalıcı silinir (`fraud-retention`).
- Nerede durdurur:
  - Kayıt, hesap oluşturma (`POST /store/customers`) ve ödeme başlatma: 403, nedeni söylemeyen metin.
  - Giriş: yanlış şifreyle aynı yanıt. Liste kimin üzerinde olduğunu söylemez.
  - Sipariş: `completeCartWorkflow` doğrulama kancası e-posta ve telefonlara bir kez daha bakar. Kartla ödenmiş sepet de böylece siparişe dönmez, parası iade akışıyla geri gider (`fraud.*` "tekrar denense de başarısız" sayılır).
- Panel: Ayarlar > Güvenlik > Kara liste, türüne göre gruplu. Liste yalnızca sahip ve yöneticiye açıktır (`/admin/fraud/blocks*` özel). İnceleme kuyruğunun okunması hassas okuma olarak denetim kaydına girer.

### Güvenlik incelemesi (2026-10-31)

Bağımsız inceleme 2 yüksek, 2 orta ve birkaç düşük bulgu çıkardı. Kapananlar:

- **Yüksek: kartla ödeme korumayı atlıyordu.** Sayım ödeme başlatmaya taşındı, siparişte kancayla yeniden bakılıyor.
- **Yüksek: `Bearer <token> x` biçimindeki başlık şifre değişikliği denetimini atlıyordu** (ADR-0037 ek 2). Başlık Medusa gibi okunuyor; okunamayan bearer token reddediliyor.
- **Orta: aynı anda gönderilen girişler doğrulama eşiğini atlıyordu.** Her deneme çalışmadan önce sayılıyor.
- **Orta: başkasının e-postasıyla ödeme kilitlenebiliyordu.** E-posta sınırı artık engellemiyor.
- **Düşükler:**
  - IP, `+etiket`, alt alan adı ve telefon eşleşmesi;
  - girişte listede olmanın sızması;
  - hesap oluşturmada denetim;
  - Medusa'nın `/admin/fulfillments` ucunda inceleme bekleyen sipariş;
  - `qt_` öneki;
  - kuyruğun hassas okuma kaydı;
  - bilinmeyen iş türünün yalnızca sahibe görünmesi.

Kalanlar (gözden geçir):

- Şifre değişmeden önce açılmış bir oturum çerezi `POST /store/customers`'a ulaşabilir (oturumda `iat` yok).
- Sipariş, puanlanmadan önceki birkaç saniyede kargoya verilebilir.
- Google ile girişte kara listeye bakılmaz (hesap oluşturmada bakılır).
- Bir başkası birinin telefonunu üç e-postayla kullanarak o kişinin bir sonraki siparişine 25 puan ekleyebilir. Bu siparişi tek başına incelemeye düşürmez.
- İş kanıtı bir hız kesicidir; yerel kodla çözen bot için ucuzdur.

## Alternatifler

| Seçenek                          | Artı                                     | Eksi                                                                                           |
| -------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| reCAPTCHA / hCaptcha             | Olgun, bot puanı                         | Yurt dışına veri; KVKK açık rıza; dış servis onayı; erişilebilirlik sorunları (görsel bulmaca) |
| Turnstile                        | Olgun, bot puanı; görsel bulmaca yok     | 2026-10-31'de reddedildi (KVKK); **Ek 2026-11-24 ile kabul**: trafik zaten Cloudflare'den geçeceği için yeni alıcı doğmuyor |
| Görsel captcha (kendi)           | Dış servis yok                           | Erişilebilirlik; OCR botları kolayca geçer                                                     |
| Her istekte iş kanıtı            | Basit                                    | Gereksiz bekleme; düşük güçlü cihazda pil                                                      |
| Kart parmak izi hızı             | Kart dolandırıcılığına en doğrudan önlem | Kart verisi bizde değil; sağlayıcının kendi 3D Secure ve risk kuralları bu katmanda            |
| Makine öğrenmesiyle puan         | Daha isabetli                            | Veri yok; açıklanamaz karar; mağaza başına küçük hacim                                         |

## Sonuçlar

- Vitrin (F18): `X-Challenge` akışı ve küçük bir çözücü (Web Worker'da SHA-256) yazılır. Sözleşme `packages/types`'ta.
- Panel: Ayarlar > Güvenlik (inceleme eşikleri, kara liste), Siparişler > İnceleme. Sipariş sayfasında inceleme işareti ve "kara listeye ekle" kısayolu sonraya.
- KVKK envanteri: `fraud_review` nedenleri kişisel veri içermez (kural adları ve sayılar); silme talebinde personel notu temizlenir. `fraud_block` silme talebinde hukuki yarar gereği kalır (ham değer zaten yok); süresi dolunca silinir.
- Sonraya: sağlayıcının ödeme sonrası kart parmak izi ve BIN ülkesiyle kural; 3D Secure sonucu (`liability shift`) puana katılır.

**F15 kapanış incelemesi (2026-10-31, öğleden sonraki değişiklikler): yüksek ve orta yok, 6 düşük; hepsi kapandı.**
- Doğrulama artık istenen zorluktan kolay bir çözümü kabul etmez (`weak`): eşiğin iki katında istenen 20 bit, önceden alınmış 18 bitlik bir çözümle atlanamaz. Personel girişinin kapsamı ayrı (`staff_login`): müşteri girişinde toplanan doğrulamalar personel girişinde geçmez.
- Herkesin tetikleyebildiği e-postaların payı bütçe başına: sepet hatırlatmaları (pazarlama) şifre sıfırlama ve doğrulama kodlarının payını tüketmez.
- Öbürleri: şablon güncellemesinin geri alınması `is_public`'i de geri yükler, gönderilmeyen alan görünürlüğü değiştirmez; terk edilmiş sepet silmede para izi listeleri sınırsız okunur ve ödemesi olan sepet atlanır; vitrin yanıtı sarmalayıcısında son yakalayıcı; panel çözücüsünde zorluk ve deneme üst sınırı; `reset-mfa` gövde şeması; webhook sırrı yenilenirken hemen önce alınmış bir teslim eski sırla bir kez imzalanabilir (belgelendi).

## Ek 2026-11-24: Cloudflare Turnstile riskli kapılarda

- **Durum:** Kabul edildi (sahip kararı 2026-11-24: "en yüksek bot koruması, katmanlı")
- **Değiştirdiği:** Bağlam'daki "dış servis yok" kısıtı Turnstile için kalkar; §1'in iş kanıtı uyarlanır kapılarda Turnstile'ın yedeği olur, sert kapılarda eşik sonrası ek katman olarak kalır.

### Neden şimdi

İş kanıtı bir hız kesicidir; yerel kodla çözen bot için ucuzdur (Güvenlik incelemesi, kalan 5. risk). Turnstile tarayıcının davranışına ve Cloudflare'in ağ çapındaki sinyallerine bakar; çözüm çiftliği dışında atlatılması pahalıdır. 2026-10-31'de reddetmemizin nedeni KVKK'ydı: ziyaretçi verisinin yeni bir yurt dışı alıcıya gitmesi. F16'da mağazaların önüne Cloudflare zaten konacak (DNS, TLS, WAF); bütün trafik Cloudflare'den geçeceği için Turnstile yeni bir veri alıcısı doğurmaz. Aydınlatma metnine Cloudflare'in adı ve aktarımın dayanağı (standart sözleşme) yazılır; bu canlıya çıkış listesindedir (F16).

### Katmanlar

1. **Cloudflare önde** (F16, altyapı; bu dilimde kod yok): WAF, bot yönetimi, DDoS.
2. **Turnstile riskli kapılarda**, yönetilen (managed) mod, görünüm `interaction-only`: widget çoğu ziyaretçide görünmez kalır, yalnız Cloudflare emin olmadığında kutu çıkar. Tamamen görünmez (invisible) mod seçilmez: şüpheli ziyaretçiye etkileşim şansı verilmeden reddedilirdi.
3. **Mevcut uygulama korumaları kalır:** hız sınırları, iş kanıtı eşikleri, kara liste, ödeme hız kuralları (§1, §2, §4).

### Kapılar

| Kapı (`action`) | Uç | Kip | Neden |
|---|---|---|---|
| `login` | `POST /auth/customer/emailpass` | Her istekte | Kimlik bilgisi doldurma (credential stuffing) en sık saldırı; IP'den bağımsız |
| `register` | `POST /auth/customer/emailpass/register` | Her istekte | Sahte hesap ve doğrulama e-postası pompalama |
| `password_reset` | `POST /auth/customer/emailpass/reset-password` | Her istekte | Herkesin tetikleyebildiği e-posta; hesap sayımı |
| `staff_login` | `POST /auth/user/emailpass` | Her istekte | Paneli koruyan kapı; 2FA arkasında da olsa şifre denemesi pahalı olmalı |
| `staff_password_reset` | `POST /auth/user/emailpass/reset-password` | Her istekte | Personel e-postası pompalama |
| `checkout` | `POST /store/carts/:id/payment-session` | Her istekte | Her ödeme yolu buradan başlar (§2); kart deneme (card testing) botu |
| `order_lookup` | `POST /store/order-lookup` | Eşikten sonra (IP başına saatte 5) | Kişisel veri tahmini; insanlar nadiren tekrarlar |
| `contact` | `POST /store/contact-messages`, `POST /store/booking-requests` | Eşikten sonra (saatte 1, sayaç ortak) | Spam; ilk mesaj sürtünmesiz |
| `newsletter` | `POST /store/newsletter` | Eşikten sonra (saatte 3) | Onay e-postası pompalama |
| `gift_card` | `POST /store/gift-cards/balance` | Eşikten sonra (15 dakikada 3) | Kod tahmini |
| `review` | `POST /store/products/:id/reviews` | Eşikten sonra (saatte 3) | Zaten oturumlu müşteri ve yazma bütçesi var |
| `question` | `POST /store/products/:id/questions`, `POST /store/product-questions/:id/answers` | Eşikten sonra (saatte 3) | Aynı |
| `stock_alert` | `POST /store/stock-alerts` | Eşikten sonra (saatte 5) | Onay e-postası pompalama |

- **Her istekte:** saldırının hedefi tek denemenin kendisi (bir şifre, bir kart, bir hesap); eşik beklemek ilk N denemeyi bedava bırakır ve dağıtık botnet her IP'de eşiğin altında kalır. `interaction-only` kipinde gerçek ziyaretçi çoğunlukla bir şey görmez, maliyeti düşük. Bu kapılarda §1'in uyarlanır iş kanıtı (kayıt, giriş, personel girişi, ödeme hız kuralları) **ek katman olarak** sürer: Turnstile'ı çözüm çiftliğiyle geçen bot, eşiği aşınca yine işlem gücü öder.
- **Eşikten sonra:** form doldurmanın kendisi risk değil, tekrarı riskli. Sayaçlar §1'in sayaçlarıdır (`fraud:challenge:<kapı>:<IP kovası>`); eşik aşılınca artık iş kanıtı değil Turnstile istenir. Yorum ve soru için yeni sayaç açıldı (eskiden yalnız hız sınırı vardı).
- Kontrol sırası: alan genelindeki hız sınırı → Turnstile → kara liste ve geri kalanı. Turnstile kara listeden önce gelir: tokensız bir bot, "yanlış şifre" ile 428 arasındaki farktan kimin listede olduğunu öğrenemez.
- Google/Apple ile giriş kapı dışında: botu sağlayıcı süzer; hesap oluşturma kara listeye bakar (§4).
- Kontrol düzleminin kendi girişi (`apps/control-plane`) bu dilimde yok; T3'te aynı doğrulayıcıyla eklenir.

### Sözleşme (istemciler)

- İstemci widget'ın token'ını `X-Turnstile-Token` başlığında gönderir; widget `action` değeri kapının adıdır (tablodaki). Token tek kullanımlıktır, her denemede widget yenilenir (`turnstile.reset()`).
- Site anahtarı: vitrin `GET /store/storefront` yanıtındaki `turnstile.site_key`, panel oturum açmadan `GET /admin/public-config` (`{ turnstile: { site_key } }`). Gizli anahtar hiçbir yanıta girmez.
- Yanıtlar:
  - Token yok: 428 `fraud.turnstile_required`, gövdede `turnstile: { action }`.
  - Token geçersiz, harcanmış, başka kapının ya da başka alan adının: 403 `fraud.turnstile_failed`, gövdede `turnstile: { action }`. İstemci widget'ı yeniler, yeniden dener.
  - Cloudflare yanıt veremiyor: 428 `fraud.challenge_required`, gövdede §1'in meydan okuması (`challenge: { token, salt, bits, expires_at }`) ve `fallback: "turnstile_unavailable"`. İstemci çözer, aynı isteği çözümle `X-Turnstile-Fallback: <token>.<nonce>` başlığında tekrarlar (§1'in `X-Challenge`'ı ayrı kalır: iki doğrulama aynı istekte birlikte istenebilir).
- Başlıklar vitrinin sunucusundan backend'e (sunucu eylemi) geçer; panel aynı kökenden çağırır. Tarayıcıdan doğrudan CORS'lu çağrı yok.

### Doğrulama (sunucu)

- `lib/security/turnstile`: Cloudflare `siteverify` (`POST https://challenges.cloudflare.com/turnstile/v0/siteverify`, JSON: `secret`, `response`, `remoteip`, `idempotency_key`). Platformun HTTP istemcisiyle: deneme başına 2 saniye, aynı `idempotency_key` ile bir tekrar, devre kesici (art arda 5 hatadan sonra 30 saniye doğrudan yedeğe). Hatalar entegrasyonlar sayfasına yazılmaz (panel mağazanındır).
- Geçerli sayılması için: `success`, `action` kapının adı, `hostname` mağazanın alan adlarından biri. Alan adları: SEO bölümündeki `canonical_host` ve `www.` ikizi, `STOREFRONT_ORIGIN`, `BACKEND_URL` (panel), isteğe bağlı `TURNSTILE_ALLOWED_HOSTNAMES` (önizleme alan adı); yerelde `localhost`.
- Token en çok 2048 karakter (Cloudflare sınırı). Başarılı token'ın özeti paylaşılan sayaç deposunda 5 dakika tutulur, ikinci kez kabul edilmez: Cloudflare'in yeniden kullanım denetimi sonunda tutarlıdır, aynı anda gelen iki istek ikisi de geçebilir.
- `remoteip` hız sınırlarının saydığı adrestir (`clientIp`): vitrin sunucusunun imzaladığı adres; yoksa `TRUST_CF_CONNECTING_IP=on` ise `CF-Connecting-IP` (tek, geçerli bir IP); yoksa bağlantının adresi. Bayrak varsayılan kapalıdır, yalnız köken sunucusu Cloudflare dışındaki trafiğe kapalıyken açılır (F16: güvenlik duvarı ya da Authenticated Origin Pulls); yoksa başlığı herkes yazabilir. Aynı adres hız sınırı kovalarına da girer.
- Log: kapının adı, neden (`refused`, `action`, `hostname`, `reused`) ve Cloudflare'in hata kodları. Token, gizli anahtar ve IP loga girmez.

### Yedek: Cloudflare yanıt vermezse

Ne açık kapı ne satış durdurma: Cloudflare'e ulaşılamaz, zaman aşımı olur, 5xx döner, yanıt bozuk gelir ya da kendi gizli anahtarımız reddedilirse (`missing-input-secret`, `invalid-input-secret`, `bad-request`, `internal-error`) §1'in iş kanıtı istenir. Yedeğin meydan okuması kapıya özel kapsamla imzalanır (`ts_<kapı>`): §1'in uyarlanır kapsamlarından (`login` vb.) alınmış bir çözüm Turnstile'ın yerine geçmez, bir kapınınki öbüründe geçmez. Çözüm tek kullanımlıktır; zorluk 18 bit. Cloudflare'in "token geçersiz" yanıtı yedeğe düşmez, 403'tür.

### Anahtarlar

- Anahtarlar **platformundur**, mağaza paneline ya da veritabanına girmez: ortam değişkeni `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, her instance'ın kendi widget'ı. Kontrol düzlemi mağaza açılırken Cloudflare API'siyle widget'ı (`mode: managed`, mağazanın alan adları) oluşturup anahtarları yazar (T3, F16).
- Yerelde ve testte ayarlı değilse Cloudflare'in resmi test anahtarları kullanılır (site `1x00000000000000000000AA`, gizli `1x0000000000000000000000000000000AA`; widget `XXXX.DUMMY.TOKEN.XXXX` verir, gizli anahtar yalnız onu kabul eder). Testte (`NODE_ENV=test`) test anahtarlarının yanıtı ağa çıkmadan, Cloudflare'in belgelediği gibi üretilir (her zaman geçen, her zaman reddeden `2x…`, harcanmış `3x…`); geliştirmede gerçek `siteverify` çağrılır. Test anahtarında `hostname` (`example.com`) ve `action` (yok) denetlenmez.
- Canlı ve hazırlıkta iki anahtar zorunludur, test anahtarı reddedilir: süreç başlamaz (`AUTH_MFA_ENCRYPTION_KEY` gibi, `lib/env.ts`). İki anahtar birlikte verilir.
- Geliştirme ve test için `TURNSTILE=off` hiç token istemez (panelin e2e'si T2'ye kadar, yük testi); geliştirme ve test dışında süreç başlamaz.

### CSP

Widget `https://challenges.cloudflare.com` adresinden betik yükler ve iframe açar. Vitrinin CSP'sine (`apps/storefront/src/lib/security/csp.ts`) ve panelin CSP'sine `script-src` ve `frame-src` için `https://challenges.cloudflare.com` eklenir (T2). Backend'in kendi CSP'si değişmez (widget backend sayfasında çizilmez).

### KVKK

Cloudflare, F16'da trafiğin tamamını taşıyacak işleyendir; Turnstile aynı işleyene aynı ziyaretçi verisini (IP, tarayıcı sinyalleri) gönderir. Canlıya çıkıştan önce (F16 listesi): aydınlatma metninde Cloudflare ve bot korumasının amacı, yurt dışı aktarımın dayanağı olarak standart sözleşme; `docs/kvkk-envanter.md`'ye satır. Biz token'ı, IP'yi ya da Cloudflare'in kararını saklamayız (yalnız 5 dakikalık token özeti, tekrar kullanımı engellemek için).

### Dilimler

- **T1 backend (bu ek):** doğrulayıcı, ortam şeması, kapı ara katmanları, yedek, `CF-Connecting-IP`, site anahtarının yayımlanması, testler. Vitrin ve panel token göndermeden birleşirse giriş, kayıt ve ödeme 428 döner: T1 ve T2 birlikte birleşir ya da geliştiriciler T2'ye kadar `TURNSTILE=off` kullanır.
- **T2 vitrin ve paneller:** widget (`interaction-only`, kapıya göre `action`), `X-Turnstile-Token`, 428/403 ve yedek akışı, CSP, `packages/types`'ta sözleşme; panel girişinde ve şifre sıfırlamada `GET /admin/public-config`. CI'daki panel e2e'sinde `TURNSTILE=off` kaldırılır.
- **T3 kontrol düzlemi (F16):** mağaza açılırken Cloudflare API'siyle widget ve anahtarlar, alan adı eklenince widget'ın alan adları; kontrol düzleminin kendi girişine Turnstile; Cloudflare önde ve köken güvenlik duvarı, ardından `TRUST_CF_CONNECTING_IP=on`.
