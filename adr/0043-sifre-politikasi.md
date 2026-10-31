# ADR-0043: Şifre politikası ve sızmış şifre denetimi

- **Durum:** Kabul edildi (2026-10-31, kullanıcı tek tek gözden geçirip onayladı; sızmış şifre denetimi canlıda açık)
- **Tarih:** 2026-10-31
- **İlgili:** docs/04 "Kimlik doğrulama" (şifre politikası); ADR-0003 (barındırma ve veri yerleşimi); ADR-0037 (müşteri hesabı); ADR-0040 (personel)

## Bağlam

docs/04 şifre politikasını baştan koymuştu: uzunluk odaklı (en az 10), sızmış şifre listesi denetimi ("k-anonymity API veya yerel liste"). F15.1 taramasında bunun sunucuda hiç uygulanmadığı görüldü:

- Medusa 2.21.2'nin `emailpass` sağlayıcısı her şifreyi kabul ediyor.
- 10 karakter sınırını yalnızca panelin davet ve şifre sıfırlama formları istiyordu. Doğrudan API'ye gelen bir istek (vitrin, betik) "123456" ile hesap açabiliyordu.

Müşteri hesapları credential stuffing'in birinci hedefi. Sızmış listelerdeki şifreler ilk denenenlerdir.

## Karar

Yeni bir şifre, personel ya da müşteri fark etmeden, iki uçta denetlenir: kayıt (`POST /auth/:actor_type/emailpass/register`) ve sıfırlama bağlantısıyla şifre değişimi (`POST /auth/:actor_type/emailpass/update`). Uygulama `api/http/password-policy.ts` ve `lib/security/password/` içinde. Reddedilen şifre 400 `invalid_data` alır, mesaj anahtarı `auth.password_<sorun>`.

1. **Uzunluk:** en az 10, en çok 256 karakter. Karakterler kişinin gördüğü gibi sayılır (`Intl.Segmenter`): "ş" bir, emoji bir karakterdir. Karakter sınıfı kuralı (büyük harf, rakam, sembol) yok; NIST 800-63B'nin önerdiği gibi uzunluk ve kara liste.
2. **Yaygın şifreler (çevrimdışı):** 10 karakterden uzun en yaygın şifrelerin ve Türkçe sık kullanılanların (takımlar, şehirler, "şifre", "parola") listesi; aynı karakterin tekrarı ve ardışık rakam dizileri. Büyük-küçük harf fark etmez (Türkçe "İ/ı" dahil). → `common`.
3. **E-posta adı:** Şifre e-posta adresinin @ öncesindeki kısmını (en az 4 karakterse) içeremez. Kayıtta adres gövdeden, sıfırlamada token'ın `entity_id`'sinden okunur. → `contains_email`.
4. **Sızmış şifre (çevrimiçi):** Have I Been Pwned "Pwned Passwords" aralık API'si, k-anonimlikle:
   - Şifrenin SHA-1 özetinin yalnızca ilk 5 onaltılık karakteri gider. Yanıt, o önekle başlayan bilinen bütün sonekleri içerir; karşılaştırma bizde yapılır.
   - `Add-Padding: true` ile yanıt sahte satırlarla (sayısı 0) doldurulur, boyutu bilgi vermez.
   - İstek `safeFetch` ile gider (2,5 saniye zaman aşımı, yönlendirme yok). Anahtar ya da hesap gerekmez.
   - Servise ulaşılamazsa şifre geçer ve uyarı loglanır (`auth.breach_check_unavailable`): dış bir kesinti kayıtları durdurmaz. Çevrimdışı kurallar (1–3) her durumda uygulanır.
   - **Kullanıcı onayladı (2026-10-31):** canlı ve staging'de (`NODE_ENV=production|staging`) varsayılan açık; geliştirme ve testte kapalı (her koşuda dış servise gitmesin). `PASSWORD_BREACH_CHECK=on|off` ikisini de geçersiz kılar.
   → `breached`.

Mevcut şifreler etkilenmez. Kural bir sonraki şifre belirlemede uygulanır. Girişte denetim yok: kural yalnızca şifrenin belirlendiği anda çalışır.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| Karakter sınıfı kuralı ("en az bir büyük harf, rakam, sembol") | Alışılmış | NIST önermez; "Sifre123!" gibi tahmin edilebilir kalıplara iter |
| Yalnızca yerel liste (milyonlarca satırlık dosya) | Dışarı istek yok | Depoda yüzlerce MB; güncel tutulmaz; yeni bağımlılık/dosya kullanıcı onayı ister |
| HIBP'yi zorunlu kılmak (ulaşılamazsa reddet) | Daha sıkı | Dış kesinti kayıtları durdurur; mağaza kaybı |
| Girişte de denetlemek ve şifre değişimini zorlamak | Eski zayıf şifreleri yakalar | Her girişte dış istek; kullanıcı deneyimi; sonraya bırakıldı |

## Sonuçlar

- Dış servis: HIBP'ye giden yalnızca 5 karakterlik bir özet önekidir; kişisel veri değildir (ADR-0003'ün veri yerleşimi sorusunu etkilemez). Açılırsa canlıda çıkış (egress) `api.pwnedpasswords.com:443`'e açık olmalı (F16). Açılmazsa çevrimdışı kurallar (1–3) tek başına uygulanır.
- Panel: davet ve sıfırlama formları zaten 10 karakter istiyordu. Sunucunun Türkçe mesajı panelde olduğu gibi görünür (`/auth/user/*` yanıtları panel için çevrilir).
- Vitrin (F18): kayıt ve sıfırlama formları aynı kuralları gösterir, mesaj anahtarlarını çevirir.
- Sonraya: girişte sızmış şifre uyarısı (zorlamadan "şifrenizi değiştirin" bildirimi).
