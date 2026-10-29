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
   - **Rolü olmayan kullanıcı:** `readonly` sayılır (kapalı varsayılan).
   - **İlk rol ataması:** Göç betiği en eski kullanıcıya `owner`, diğerlerine `admin` verir.
   - **Son owner koruması:** Son `owner`'ın rolü düşürülemez ve silinemez.
   - **Panel bilgisi:** Panel kullanıcının rolünü ve yetenek listesini `GET /admin/staff/me`'den alır. Yetkisiz düğmeler gizlenir; API her durumda yeniden denetler.
2. **2FA: Medusa'nın yerleşik MFA'sı, zorunlu.**
   - **Açma:** `AUTH_MFA_ENCRYPTION_KEY` ortam değişkeniyle açılır. Canlıda zorunlu, env şemasında.
   - **Zorunluluk:** Bütün personel için. Etkeni olmayan kullanıcı giriş yapabilir ama yalnızca kendi 2FA kaydı, `users/me` ve çıkış uçlarına geçer; diğer her uç 403 `staff.mfa_required` döner. Panel kullanıcıyı "2FA'yı kur" ekranına götürür (KK1: 2FA'sız owner girişi engellenir).
   - **Yerel geliştirme:** Yalnızca `development`/`test`'te `ADMIN_MFA=off` ile kapatılabilir; canlıda yok sayılır ve günlüğe uyarı yazılır.
   - **Panel akışı:** Girişte kod adımı, kurtarma koduyla giriş. Ayarlar > Hesabım > Güvenlik: kurulum (QR + elle girilecek sır), kurtarma kodları, etkeni yenileme.
   - **e2e:** Testler TOTP kodunu Node `crypto` ile kendisi üretir (RFC 6238; bağımlılık yok).
3. **Yeniden doğrulama (ADR-0027'nin ikinci doğrulaması).**
   - **Hangi işlemler:** Hesapların gizli alanı, mağaza/üye işyeri numarası ve test modu değişikliği; API anahtarı oluşturma; owner rolü verme ve alma.
   - **Kural:** Son 5 dakikada 2FA kodu girilmiş olmalı.
   - **Nasıl:** Medusa'nın oturum içi yeniden doğrulama desteği Y4'ün başında doğrulanır. Yoksa kendi ucumuz (`POST /admin/staff/step-up {code}`) kodu auth modülünün etkeni üzerinden doğrular ve zamanı oturuma yazar.
4. **Davet ve personel ekranı.**
   - **Davet:** Medusa davetleri kullanılır, istenen rol davetin `metadata`'sına yazılır. Kabulde (`user.created` ya da davet kabul olayı; Y2'de doğrulanır) rol atanır.
   - **Panel ekranları:** Ayarlar > Ekip (liste, rol, 2FA durumu, davet, rol değiştir, çıkar) ve `/invite` kabul sayfası. Medusa Admin'e gerek kalmaz.
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
- **Canlıya çıkış engeli:** ADR-0027'deki engel Y4 bitince kalkar.
- **Rota tablosunun bakımı:** Medusa'nın yeni çekirdek uçları `admin` için açık, `operations` ve `readonly` için kapalı gelir. Her Medusa yükseltmesinde tablo gözden geçirilir (yükseltme kontrol listesine). Birim testi her personel uç kalıbının tabloda bir kararı olduğunu doğrular.
- **QR kodu:** QR için küçük bir kütüphane gerekebilir (öneri: `uqr`, bağımlılıksız). Yeni bağımlılık kullanıcı onayı ister. Onay gelene kadar ekran sırrı ve `otpauth` bağlantısını elle girilecek biçimde gösterir.
- **Medusa RBAC'e geçiş:** Medusa RBAC belgelenip kararlı hale gelince geçiş yeniden değerlendirilir (2.22 yükseltmesi ya da F17).
