# Veri ihlali müdahale kılavuzu

> F13.10, ADR-0041 §7, docs/04 "Veri ihlali müdahalesi". Kişisel veriye yetkisiz erişildiğinden, veri sızdığından ya da kaybolduğundan şüphelenildiği anda açılır.
> Yasal yükümlülüklerin kesin hali KVKK danışmanıyla doğrulanır (docs/12). Bu dosya o doğrulamaya kadar en sıkı yorumu uygular.
> **Sorumluluk paylaşımı:** Mağaza veri sorumlusudur: Kurul'a ve ilgili kişilere bildirimi o yapar. Platform (Quant Dijital) veri işleyendir: ihlali mağazaya gecikmeden bildirir ve bildirim için gereken bilgiyi sağlar. Ayrıntı veri işleme sözleşmesinde yazılır (docs/12, F16–F17).

## Roller ve iletişim

Olay sırasında aranacak kişiler. **Doldurulacak:** Kişiler belli olunca isim ve telefon yazılır, yılda bir gözden geçirilir.

| Rol | Kim | Ulaşma | Görevi |
| --- | --- | --- | --- |
| Olay sorumlusu | _doldurulacak_ (Quant Dijital) | _telefon_ | Olayı açar, kararları verir, zaman çizelgesini tutar |
| Teknik sorumlu | _doldurulacak_ | _telefon_ | Sınırlama, kanıt, etki analizi |
| İletişim sorumlusu | _doldurulacak_ | _telefon_ | Mağazaya ve gerekirse müşterilere yazılacakları hazırlar |
| KVKK danışmanı | _doldurulacak_ | _e-posta_ | Bildirim gerekip gerekmediği, içerik, süre |
| Avukat | _doldurulacak_ | _e-posta_ | Hukuki risk, sözleşme yükümlülükleri |
| Mağazanın irtibat kişisi | mağaza başına; panelde Ayarlar > Mağaza > iletişim | — | Veri sorumlusu adına bildirimleri yapar |
| Barındırma ve e-posta sağlayıcısı | sağlayıcı destek hattı | — | Altyapı kayıtları, erişim kapatma |

## Zaman çizelgesi

**T0 = ihlalin öğrenildiği an** (şüphenin ciddileştiği an; kesinleşmesi beklenmez).

| Ne zaman | Ne |
| --- | --- |
| T0 + 1 saat | Olay kaydı açıldı, olay sorumlusu ve teknik sorumlu haberdar. Sınırlama başladı. |
| T0 + 24 saat | Mağazaya ilk bildirim yapıldı (veri işleyen olarak). Bilinmeyenler "inceleniyor" diye yazılır. |
| T0 + 72 saat | Mağaza Kurul'a bildirdi (KVKK md. 12/5; Kurul kararı 2019/10). Bilgi eksikse bilinenle bildirilir, gerisi sonradan eklenir. |
| Makul en kısa süre | Etkilenen kişilere bildirim (mağaza adına, mağazanın iletişim bilgileriyle). |
| Olay kapanınca + 14 gün | Olay sonrası rapor. |

## 1. Tespit ve kayıt

1. `docs/runbooks/olaylar/` altında `YYYY-MM-DD-kisa-ad.md` dosyası açılır ve aşağıdaki **olay günlüğü** şablonu doldurulur. Olay günlüğüne müşteri verisi yazılmaz, yalnızca sayılar ve kategoriler.
2. Kanıtlar silinmeden alınır:
   - Uygulama günlükleri (Sentry, barındırmanın günlükleri) ilgili zaman aralığı için dışa alınır.
   - Denetim kaydı, panelde Ayarlar > Denetim kaydı > dışa aktar ile alınır (tarih aralığı ve kişi süzgeciyle). Dosya 7 gün sonra silinir; şifreli bir yere taşınır.
   - Veritabanının o anki yedeği alınır ve şifreli olarak ayrı yerde saklanır.
3. Olay sorumlusu ilk değerlendirmeyi yazar: ne oldu, ne zaman fark edildi, hangi mağaza(lar). Her mağazanın veritabanı ayrıdır; olay çoğunlukla bir mağazayla sınırlıdır.

## 2. Sınırlama

Önce sızıntıyı durdur, sonra araştır. Uygulanan her adım olay günlüğüne saatiyle yazılır.

| Şüphe | Adım |
| --- | --- |
| Bir personel hesabı ele geçirildi | Ayarlar > Ekip'te üyenin rolü alınır ya da üye çıkarılır (oturumları düşer). Mağaza genelinde 2FA zorunlu değilse Ayarlar > Güvenlik'ten açılır. Hesabın denetim kaydı incelenir: kayıtlı okumalar, dışa aktarmalar. |
| Bir API anahtarı sızdı | Ayarlar > Dış API'de anahtar iptal edilir. Denetim kaydında anahtarın (`api-key`) yaptıkları süzülür. |
| Giden web kancası yanlış adrese gidiyor | Ayarlar > Dış API > Web kancaları'nda abonelik kapatılır. |
| Sağlayıcı hesabı (PayTR, iyzico, Aras, Yurtiçi, Netgsm, Resend, Meta, GA4) sızdı | Sağlayıcının kendi panelinde anahtar yenilenir, sonra Ayarlar > Entegrasyonlar'da yeni anahtar girilir. |
| Sunucu, veritabanı ya da yedek erişimi | Barındırma tarafında erişim kapatılır, parolalar ve bağlantı bilgileri yenilenir. `PII_ENCRYPTION_KEY` ve `PII_HASH_KEY` de sızmış sayılır (aşağıda). |
| Şifreleme anahtarı sızdı | Şifreli alanlar (envanterde "Ş": vergi no, IP, sözleşme kopyaları, ileti adresleri) okunabilir sayılır. Anahtar yenileme prosedürü F16'da yazılacak (**açık**); o zamana kadar etki analizinde bu alanlar düz metin gibi değerlendirilir. |
| Mağaza vitrininden ya da API'den toplu çekim | Hız sınırları (docs/04) ve günlükler incelenir; gerekirse barındırmada kaynak IP engellenir. |

Gerekirse mağaza geçici olarak kapatılır. Bunun için bir bakım modu F16'da gelecek (**açık**); o zamana kadar barındırma tarafında trafik kesilir.

## 3. Etki analizi

Sorular ve nerede bakılacağı:

- **Hangi veri?** `docs/kvkk-envanter.md` tablosundan etkilenen tablolar seçilir. Saklama biçimine bakılır: özet (Ö) geri çevrilemez; şifreli (Ş) alanlar, anahtar sızmadıysa okunamaz.
- **Kaç kişi?** Etkilenen tablolardaki satır sayısı ve tekil müşteri sayısı (kişi verisi değil, sayı) alınır.
- **Hangi kategori?** Kimlik (ad), iletişim (e-posta, telefon), adres, müşteri işlem (sipariş, tutar), finans (vergi no; kart verisi bizde tutulmaz, sağlayıcıda kalır), işlem güvenliği (IP, tarayıcı).
- **Özel nitelikli kişisel veri var mı?** Platform tasarım gereği tutmaz. Serbest metin alanlarında (notlar, yorumlar) bulunabilir; kontrol edilir.
- **Ne zaman başladı, ne zaman durdu?** Denetim kaydı ve günlüklerden belirlenir.
- **Kişiler için olası sonuç?** Oltalama (phishing), dolandırıcılık, itibar. Bildirim metnine "ne yapmalısınız" bölümü buna göre yazılır.

## 4. Mağazaya bildirim (veri işleyen → veri sorumlusu)

İletişim sorumlusu hazırlar, olay sorumlusu onaylar. Mağazanın irtibat kişisine e-postayla ve telefonla iletilir.

```
Konu: [Gizli] Mağazanızın verileriyle ilgili güvenlik olayı – <tarih>

Merhaba <ad>,

<T0 tarihi ve saati> itibarıyla <kısa açıklama> tespit ettik.
Etkilenen veriler: <kategoriler>; yaklaşık <sayı> kişi.
Olayı <saat> itibarıyla sınırladık: <alınan önlemler>.
İnceleme sürüyor; bilinmeyenler: <...>.

KVKK uyarınca Kişisel Verileri Koruma Kurulu'na 72 saat içinde (<son tarih ve saat>) bildirim yapmanız gerekebilir.
Bildirim formu için gereken bilgileri ekte gönderiyoruz; formu birlikte doldurabiliriz.
Bir sonraki bilgilendirme: <tarih ve saat>.

<olay sorumlusu, telefon>
```

## 5. Kurul bildirimi

- **Kim yapar:** Mağaza (veri sorumlusu). Platform, formu doldurmak için gereken teknik bilgiyi verir.
- **Nasıl:** Kurul'un veri ihlali bildirim formu ile. Güncel yöntem KVKK danışmanına sorulur.
- **Formda istenenler:** olayın tarihi ve öğrenilme tarihi, nasıl gerçekleştiği, etkilenen kişi ve kayıt sayısı, veri kategorileri, olası sonuçlar, alınan ve alınacak önlemler, iletişim kişisi.
- **Gecikme:** 72 saat geçerse gecikmenin gerekçesi yazılır.

## 6. İlgili kişilere bildirim

- Mağaza adına, mağazanın kendi iletişim bilgileriyle, makul en kısa sürede yapılır. Kurul'un yöntem kararı danışmanla teyit edilir.
- Yöntem: e-posta (adresi biliniyorsa). Gerekirse mağazanın sitesinde duyuru.
- Bu tür toplu bir ileti panelden gönderilemez; ticari ileti değildir, İYS izni gerekmez. Gönderim teknik sorumluyla, e-posta sağlayıcısı üzerinden yapılır ve kaydı tutulur.

```
Konu: Kişisel verilerinizle ilgili bilgilendirme

Sayın <ad>,

<tarih> tarihinde <mağaza adı> sistemlerinde <kısa ve anlaşılır açıklama> meydana geldi.
Bu olaydan etkilenen bilgileriniz: <kategoriler>. Kart bilgileriniz sistemlerimizde tutulmadığından etkilenmedi.
Aldığımız önlemler: <...>.
Sizden ricamız: <ör. sizden şifre isteyen e-postalara itibar etmeyin; hesabınızın şifresini değiştirin>.

Sorularınız için: <mağazanın iletişim e-postası ve telefonu>
<mağaza unvanı>
```

## 7. Olay sonrası rapor

Olay kapandıktan sonra en geç 14 gün içinde olay dosyasına eklenir:

- Zaman çizelgesi: T0, sınırlama, bildirimler.
- Kök neden ve kanıtı.
- Kalıcı düzeltmeler: kod, ayar, süreç. Her biri iş olarak PROGRESS'e girer.
- Bu kılavuzda neyin işlemediği ve nasıl değiştiği.
- Mağazaya giden son rapor.

## Olay günlüğü şablonu

```
# Olay: <kısa ad>
- Mağaza(lar):
- T0 (öğrenme):            Kim fark etti, nasıl:
- Olay sorumlusu:          Teknik sorumlu:
- Durum: açık | sınırlandı | kapandı

## Zaman çizelgesi
| Saat | Ne yapıldı / ne öğrenildi | Kim |
| --- | --- | --- |

## Etki
- Veri kategorileri:
- Kişi sayısı (yaklaşık):
- Şifreli alanlar etkilendi mi, anahtar güvende mi:

## Bildirimler
- Mağazaya:                 (saat, kanal)
- Kurul'a (mağaza):         (saat, başvuru no)
- İlgili kişilere:          (saat, yöntem, sayı)

## Kapanış
- Kök neden:
- Düzeltmeler (PROGRESS satırları):
```

## Tatbikat

- Yılda en az bir kez ve bu kılavuz önemli ölçüde değişince yapılır.
- Senaryo ve kayıt şablonu: `docs/runbooks/tatbikatlar/README.md`.
- Kaydı `docs/runbooks/tatbikatlar/YYYY-MM-DD.md` olarak tutulur (KK5).
