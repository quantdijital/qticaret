# ADR-0040: Personel rolleri, yönetici 2FA ve yeniden doğrulama

- **Durum:** Önerildi (2026-10-29; kullanıcının "önerileni uygula" kuralıyla otonom kabul edilir, PROGRESS "Gözden geçir"de)
- **Tarih:** 2026-10-29
- **İlgili:** F12.6; ADR-0027 (hesaplar panelden; canlıya çıkış engeli), ADR-0039 §6 (API anahtarı kapsamları), ADR-0022 (kendi panelimiz), docs/04 (yönetici hesapları), docs/06 (kontrol listesi: "rol kontrolü hem UI'da hem API'de")

## Bağlam
Panelde giriş yapan her personel her şeyi yapabiliyor. Yalnızca `requireUserActor` var: kişi mi, anahtar mı? Somut boşluklar:
- **Hesap uçları:** Ödeme ve entegrasyon hesap uçları her personele açık (ADR-0027). Bu, canlıya çıkışın önündeki engel: personeli olan mağaza ödemeyle canlıya alınmaz.
- **Ayar uçları:** Ayarlar, özellik bayrakları, API anahtarları, webhook'lar ve denetim kaydı da herkese açık.
- **2FA:** Yönetici girişi tek etkenli.
- **Personel işleri:** Davet, rol ve silme yalnızca kapalı Medusa Admin'de (`MEDUSA_ADMIN=on`) yapılabiliyor.

Medusa 2.21.2'de doğrulananlar (v2.21.2 kaynağı ve docs.medusajs.com; Context7 kotası dolu):
- **Çok etkenli doğrulama (MFA) yerleşik** (`docs.medusajs.com/resources/commerce-modules/auth/mfa`):
  - TOTP etkeni ve kurtarma kodları var.
  - `POST /auth/user/emailpass` etkeni olan kullanıcıya `mfa_required` ve bir meydan okuma döner.
  - Kod `POST /auth/mfa/challenges/:id/verify` ile doğrulanır, oturum `POST /auth/session` ile açılır.
  - Kayıt uçları: `POST /auth/mfa/factors` (`secret`, `otpauth_url`) ve `/auth/mfa/factors/:id/verify`. Kurtarma kodları da var.
  - `auth_context` alanları: `mfa_enabled`, `mfa_challenge_completed_at`.
  - `authenticate(..., { requireMfa })` yalnızca etkeni olanlardan kod ister. Etken kaydetmemiş kullanıcı serbesttir: zorunluluk bizde.
- **Rol modülü yerleşik ama erken aşamada.** `@medusajs/rbac` modülü `rbac` bayrağıyla (`MEDUSA_FF_RBAC`, varsayılan kapalı) açılıyor.
  - Rotalar `policies` ile korunuyor.
  - Roller oturum jetonuna giriş anında yazılıyor; rol değişikliği yeniden girişe kadar geçmiyor.
  - Belge sayfası yok, `policies` alanı tip belgesinde gizli.
  - Çekirdek yönetim uçları politika taşıyor (ör. siparişlerde 21 girdinin 16'sı; bazı okumalar taşımıyor). Bu, ileride Medusa RBAC'ine geçişi kolaylaştırır.
- **Davet:** `POST /admin/invites` `metadata` alır. Kabul, aktörü olmayan bir kimlikle `POST /admin/invites/accept` üzerinden yapılır.
- **Kullanıcı modeli:** Kullanıcıda durum alanı yok. Kişi kendi hesabını silemez.

## Karar
1. **Sabit dört rol, kendi ince katmanımızla.**
   - **Modül:** `staff-roles` (kullanıcı başına tek rol: `owner`, `admin`, `operations`, `readonly`).
   - **Koruma:** Genel `/admin/*` koruması (`api/http/staff-guard.ts`) API anahtarı korumasının yanında, onunla aynı desende çalışır: Medusa'nın kimlik doğrulamasından sonra, ham yol (`routePathKeepingCase`) ve yöntemle `lib/staff/permissions.ts` tablosundan karar verir.
   - **Rol okuma:** Rol her istekte okunur (süreç içi önbellek, değişiklikte Redis sürüm işaretiyle düşer). Değişiklik bir sonraki istekte geçerlidir.
   - **Yetkiler:**
     - `owner`: her şey. Yalnızca o yapabilir: ödeme/entegrasyon hesapları, personel ve roller, API anahtarları, mağazanın silinmesi gibi geri dönüşsüz işler.
     - `admin`: `owner`'a ayrılanlar dışında her şey. Varsayılan izinli, kara liste.
     - `operations`: Her şeyi okur (personel listesi, denetim kaydı ve hesap ayrıntıları hariç). Yazma yalnızca beyaz listedeki operasyon uçlarında: sipariş, kargo, iade/değişim, stok, yorum/soru moderasyonu, bildirim okundu. Ayarları değiştiremez (KK1). Varsayılan ret.
     - `readonly`: yalnızca okur, aynı hariç tutmalarla. Kendi hesabının 2FA uçlarına yazabilir.
   - **Rolü olmayan kullanıcı:** Hiçbir yere erişemez; yalnızca kim olduğunu ve rolünün olmadığını görür (`staff.no_role`). Ekipten çıkarılan kişinin açık oturumu da bir sonraki istekte bu duruma düşer (Y2'de Y1'in "salt-okunur say" kararı daraltıldı).
   - **İlk rol ataması:** Göç betiği en eski kullanıcıya `owner`, diğerlerine `admin` verir.
   - **Son owner koruması:** Son `owner`'ın rolü düşürülemez ve silinemez.
   - **Panel bilgisi:** Panel kullanıcının rolünü ve yetenek listesini `GET /admin/staff/me`'den alır. Yetkisiz düğmeler gizlenir; API her durumda yeniden denetler.
2. **2FA: Medusa'nın yerleşik MFA'sı; ekip için zorunluluk sahibin anahtarı (kullanıcı kararı, 2026-10-29: "aç kapa şeklinde yap").**
   - **Anahtarlar (Ayarlar > Güvenlik):**
     - "Ekip için zorunlu" yalnızca sahibin anahtarıdır (`security.staff_mfa_required`, varsayılan açık); her iki yönde onay ister, denetim kaydına düşer.
     - Kapalıyken 2FA kurmamış personel şifreyle girer; kuranlardan Medusa yine kod ister.
     - Her kişi kendi 2FA'sını aynı sayfadan açar (kurulum) ya da kapatır. Zorunluluk açıkken kendi 2FA'sını kapatamaz.
   - **Sunucu betikleri:** sahip panele giremezse zorunluluk `set-staff-mfa.ts on|off`, bir kişinin 2FA'sı `reset-staff-mfa.ts <email>` ile değiştirilir.
   - **Açma:** `AUTH_MFA_ENCRYPTION_KEY` ortam değişkeniyle açılır. Canlıda zorunlu, env şemasında.
   - **Zorunluluk:** Bütün personel için. Etkeni olmayan kullanıcı giriş yapabilir ama yalnızca kendi 2FA kaydı, `users/me` ve çıkış uçlarına geçer; diğer her uç 403 `staff.mfa_required` döner. Panel kullanıcıyı "2FA'yı kur" ekranına götürür (KK1: 2FA'sız owner girişi engellenir).
   - **Yerel geliştirme:** Yalnızca `development`/`test`'te `ADMIN_MFA=off` ile kapatılabilir; canlıda yok sayılır ve günlüğe uyarı yazılır.
   - **Panel akışı:** Girişte kod adımı, kurtarma koduyla giriş. Ayarlar > Hesabım > Güvenlik: kurulum (QR + elle girilecek sır), kurtarma kodları, etkeni yenileme.
   - **e2e:** Testler TOTP kodunu Node `crypto` ile kendisi üretir (RFC 6238; bağımlılık yok).
   - **Uygulama (Y3a, 2026-10-29):**
     - Oturum giriş anındaki `auth_context`'i saklar; belirteç yenileme MFA alanlarını yeniden okumaz (2.21.2 kaynağı). Bu yüzden zorunluluk "bu oturum kodu geçti mi" (`mfa_challenge_completed_at`) sorusuna bakar. Kurulumu bitiren kişi çıkıp kodla yeniden girer; kurulumdan önce açılmış oturumlar da böylece kapanır.
     - Uygulamada görünen ad (issuer) panelin adresidir; kurtarma kodu sayısı Medusa'nın varsayılanı (10).
     - Yerelde anahtar `pnpm env:init` ile `.env` ve `.env.test`'e üretilir. Entegrasyon testleri `ADMIN_MFA=off` ile başlar, 2FA takımı açar. e2e, ortamda 2FA açıksa kurulum ekranından anahtarı okuyup kodu kendisi üretir.
3. **Yeniden doğrulama (ADR-0027'nin ikinci doğrulaması; uygulama Y4, 2026-10-29).**
   - **Neden zaman penceresi değil, istek başına kanıt:** Medusa 2.21.2'de oturum içi yeniden doğrulama yok; oturum giriş anındaki `auth_context`'i saklar ve yenilemede değiştirmez (§2). "Son 5 dakikada kod girildi" bilgisini oturuma yazmak çekirdek oturum deposuna dokunmayı gerektirirdi. Bunun yerine hassas istek kanıtını kendi başlıklarında taşır; ayrı bir `step-up` ucu ve oturum durumu yoktur.
   - **Başlıklar:** `X-Reauth-Method` (`totp` | `recovery_code` | `password`) ve `X-Reauth-Secret`. Sır yüzde kodlamalı (UTF-8) gelir: başlık yalnızca Latin-1 taşır, şifrede "ş", "ı" olabilir. Kodlar kırpılır, şifre yazıldığı gibi alınır; TOTP yalnızca 6 rakam.
     - 2FA'sı olan kişi uygulamadaki kodu ya da bir kurtarma kodunu verir; şifresi yetmez.
     - 2FA'sı olmayan (zorunluluk kapalı) kişi şifresini verir.
   - **Yanıtlar:** Kanıt yoksa 428 `staff.reauth_required`, yanlışsa 428 `staff.reauth_failed`.
   - **Kilit:** Yalnızca yanlış kanıtlar sayılır: 15 dakikada 10 ya da günde 30 yanlıştan sonra o kişinin kanıtları pencere bitene kadar 429 `staff.reauth_locked` alır (doğrusu da). Aynı anda gönderilen kanıtlar sayılmadan önce kontrol edildiği için dakikada 10 kanıt üst sınırı vardır. Böylece onlarca hesabı arka arkaya kuran sahip durdurulmaz, kaba deneme ayda ~%0,3 ihtimalle sınırlı kalır. Sayaçlar kişi başına, paylaşılan hız sınırı deposunda (sayaç deposuna sayısını artırmadan okuyan `peek` eklendi).
   - **Doğrulama:**
     - TOTP: auth modülünün kendi etkeni üzerinden (`createAuthMfaChallenge` + `verifyAuthMfaChallenge`).
     - Kurtarma kodu: Medusa tek kullanımlık sayar.
     - Şifre: `emailpass` sağlayıcısı, giriş kaydının kişinin kendisine ait olduğu denetlenir.
     - Medusa TOTP kodunu yeniden kullanmaya karşı korumaz. Bu yüzden kabul edilen kod 2 dakika boyunca (HMAC özetiyle) saklanır ve ikinci kez kabul edilmez.
   - **Hangi işlemler** (`api/http/reauth-routes.ts`; web kancası, davet, 2FA kurulumu ve kurtarma kodu bağımsız güvenlik incelemesinden sonra eklendi; ölçüt: çalınmış bir oturumun mağazanın parasına ya da verisine ulaşmak ya da tutunmak için kullanabileceği her şey):
     - Sağlayıcı hesaplarının yazılması ve silinmesi;
     - API anahtarı oluşturma (iptal etmek erişimi azalttığı için sormaz);
     - web kancası açma ve adresini değiştirme (olaylarını değiştirmek, durdurmak, silmek sormaz);
     - ekibe davet (davetle gelen kişinin erişimi oturumdan uzun yaşar);
     - kendi 2FA'sını kurarken ilk kodu onaylama (`/auth/mfa/factors/:id/verify`): henüz etken olmadığı için kanıt şifredir. Yoksa çalınmış oturum kendi uygulamasını kaydedip bundan sonra o uygulamanın kodlarıyla her şeyi kanıtlardı;
     - yeni kurtarma kodu üretme (`/auth/mfa/recovery-codes`): uygulama kodu ister; yoksa çalınmış oturum kendi kodlarını üretip onlarla kanıtlardı. Kurulumun hemen ardından panel kurulumun kendi kodunu kanıt olarak gönderir;
     - havale/EFT hesapları (`platform-settings/bank_transfer`);
     - ekip 2FA zorunluluğunu kapatma (açmak sormaz);
     - birine sahip rolü verme, bir sahibin rolünü değiştirme ya da onu çıkarma;
     - bir kişinin 2FA'sını sıfırlama;
     - kişinin kendi 2FA'sını kapatması (yalnızca etkinleşmiş etken; yarım kalmış kurulum sormaz);
     - müşterinin tam vergi numarasını görme (`POST /admin/customers/:id/billing-profile/reveal`; önce denetim kaydına `sensitive_read` yazılır, yazılamazsa numara gösterilmez; yanıt `no-store`).
   - **Medusa'nın kendi yolları kapalı:** `DELETE /admin/users/:id`, `POST /admin/invites`, `POST /admin/invites/:id/resend`, `DELETE /admin/invites/:id` sahip dahil kimseye açık değil (`staff.forbidden`). Bunlar son sahip korumasını, yeniden doğrulamayı ve rolü atlıyordu; aynı işler `/admin/staff` altında. Medusa'nın davet kabul ucu açık kalır (rolsüz kullanıcı zaten hiçbir yere erişemez).
   - **Kalan risk:** Girişte kullanılan TOTP kodu, aynı 30 saniyelik adımda bir kez de yeniden doğrulamada kullanılabilir (yalnızca yeniden doğrulamada kullanılan kodlar saklanıyor). Gerçek zamanlı bir oltalama vekili bunu kullanabilir; giriş kodlarını da saklamak Medusa'nın meydan okuma kaydının iç alanlarını gerektiriyor, kaynağı doğrulanmadan yapılmadı.
   - **Panel:** Hassas çağrılar `withReauth` ile sarılır. 428 gelince kabuktaki `ReauthHost` penceresi kodu (ya da kurtarma kodunu, 2FA yoksa şifreyi) ister, çağrı başlıklarla yeniden yapılır. Kanıt yalnızca o istekte kullanılır, saklanmaz. Kapatılan pencere işlemi yapmaz. 2FA kurulum sayfası kabuğun dışında olduğu için şifreyi pencereyle değil, kurulum formunda kodun yanında ister.
4. **Davet ve personel ekranı.**
   - **Davet:** Medusa davetleri kullanılır, istenen rol davetin `metadata`'sına yazılır. Medusa kabulde rolü taşımaz ve daveti siler (2.21.2 kaynağı). Bu yüzden kabul kendi ucumuzdan yapılır: `POST /admin/staff/invites/accept` önce davetin rolünü okur, sonra Medusa'nın `acceptInviteWorkflow`'unu çalıştırır, ardından rolü verir; adımlar telafilidir. Medusa'nın kendi kabul ucuyla açılan kullanıcının rolü olmaz, hiçbir yere erişemez.
   - **Kabul koşulları:** Giriş kaydı davet edilen adrese ait olmalıdır; bağlantıyı başkasına iletmek başka birini personel yapmaz. Davetle sahip rolü verilmez; sahip ekipten, sahip tarafından yapılır.
   - **Bağlantı:** Davet e-postayla gider (`staff.invite` şablonu). Bağlantı yalnızca oluşturma ve yeniden gönderme yanıtında sahibe de gösterilir; e-posta kurulu değilse elle iletilir. Bağlantı 24 saat geçerlidir (Medusa varsayılanı).
   - **Panel ekranları:** Ayarlar > Ekip (liste, rol, davet, rol değiştir, çıkar; sahip olmaya ve kendi rolünü değiştirmeye ek onay) ve `/invite` kabul sayfası. Medusa Admin'e gerek kalmaz.
   - **Denetim kaydı:** Rol değişiklikleri, davetler ve 2FA sıfırlama panelden `mutation`, sistemden (göç betiği, sunucu betiği) `system` olarak yazılır.
5. **API anahtarları değişmez.** Anahtarlar personel rolüne değil kendi kapsamlarına tabidir (ADR-0039 §6). Personel korumasından önce anahtar koruması çalışır.

## Alternatifler
| Seçenek | Artı | Eksi |
|---|---|---|
| Medusa RBAC'i açmak (`MEDUSA_FF_RBAC`) | Medusa'nın kendi modeli; çekirdek uçlar politika taşıyor; davetle rol; rol yönetimi uçları hazır | Belgesiz ve bayrak arkasında; rol değişikliği yeniden girişe kadar geçmez; okuma uçlarının bir kısmı politikasız; 2.22 yükseltmesinde değişebilir |
| Kendi katmanımız, serbest rol/politika tanımı | Esnek | Docs/04'ün istediği dört rol için gereksiz karmaşıklık; yanlış yapılandırma riski |
| **Kendi katmanımız, sabit dört rol + rota tablosu** | API anahtarı katmanıyla aynı desen; değişiklik anında geçerli; kapalı varsayılan (operasyon, salt-okunur) | Medusa yeni uç ekledikçe tablo gözden geçirilmeli (admin için kara liste, diğerleri için beyaz liste bu riski azaltır) |
| 2FA'yı kendimiz yazmak | — | Medusa yerleşik sunuyor; gereksiz |
| 2FA'yı yalnızca owner'a zorunlu tutmak | Kurulum kolaylığı | Ayar değiştiremeyen hesaplar bile müşteri verisi okur; hepsi zorunlu |

## Sonuçlar
- **Canlıya çıkış engeli:** ADR-0027'deki engel Y4 ile kalktı (2026-10-29): sağlayıcı hesapları, banka hesapları ve API anahtarları hem sahibe ayrılmış hem de yeniden doğrulama istiyor.
- **Rota tablosunun bakımı:** Medusa'nın yeni çekirdek uçları `admin` için açık, `operations` ve `readonly` için kapalı gelir. Her Medusa yükseltmesinde tablo gözden geçirilir (yükseltme kontrol listesine). Birim testi her personel uç kalıbının tabloda bir kararı olduğunu doğrular.
- **QR kodu:** `uqr` 0.1.3 (bağımlılıksız; kullanıcı onayı 2026-10-29). Kurulum ekranı QR'ın yanında sırrı elle girilecek biçimde de gösterir.
- **Medusa RBAC'e geçiş:** Medusa RBAC belgelenip kararlı hale gelince geçiş yeniden değerlendirilir (2.22 yükseltmesi ya da F17).
