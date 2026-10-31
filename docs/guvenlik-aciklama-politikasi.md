# Güvenlik açığı bildirme politikası

> F15.9. Bu metin platformun ve mağazaların sitesinde `/.well-known/security.txt`'deki `Policy` bağlantısının gösterdiği sayfanın kaynağıdır. Dosyayı backend üretir (`GET /store/seo/security`; `SECURITY_CONTACT`, `SECURITY_POLICY_URL`), vitrin sunar. **Kararlar (kullanıcı, 2026-10-31):** adres `guvenlik@quantdijital.com`, aşağıdaki süreler ve yumuşatılmış güvenli liman maddesi. Yayın F16'da canlıya çıkışla birlikte; o zamana kadar bir avukat bulunursa güvenli liman maddesi ona gösterilir.

## Kapsam

- Quant Ticaret altyapısında çalışan mağazaların siteleri, mağaza API'leri (`/store`, `/auth`) ve yönetici paneli.
- Platformun kendi alan adları.

Kapsam dışı:

- Mağazaların kendi seçtiği üçüncü taraf hizmetler: ödeme, kargo, e-fatura sağlayıcısı. Bunlar kendi programlarına bildirilir.
- Hizmet engelleme (DoS) denemeleri, yük testleri.
- Sosyal mühendislik ve fiziksel erişim.
- Otomatik tarayıcı çıktısının doğrulanmamış hâli.
- Güncel olmayan tarayıcılarda görülen sorunlar.

## Nasıl bildirilir

- Adres: `guvenlik@quantdijital.com` (`security.txt`'deki `Contact`; bütün mağazalar için aynı).
- Bildirimde şunlar yer alır: etkilenen adres, adım adım yeniden üretme, beklenen ve gerçekleşen sonuç, varsa kavram kanıtı.
- Gerçek müşteri verisine erişildiyse yalnızca kanıt için gereken en az veri gösterilir, kopya tutulmaz.
- Türkçe ya da İngilizce yazılabilir.

## Kurallar

- Yalnızca kendi hesaplarınızla ve kendi oluşturduğunuz verilerle test edin.
- Başkasının verisine erişmeyin, değiştirmeyin, silmeyin. Erişirseniz durun ve bildirin.
- Açığı düzeltilene kadar kamuya açıklamayın. Açıklama tarihi birlikte kararlaştırılır.
- Hız sınırlarına uyun; otomatik taramayı saniyede birkaç istekle sınırlayın.

## Bizim taahhüdümüz (SLA)

| Adım | Süre |
|---|---|
| Alındı yanıtı | 3 iş günü |
| İlk değerlendirme ve önem derecesi | 10 iş günü |
| Düzeltme: kritik | 7 gün |
| Düzeltme: yüksek | 30 gün |
| Düzeltme: orta | 90 gün |
| Düzeltme: düşük | Bir sonraki planlı sürüm |

Önem derecesi CVSS 4.0'a göre belirlenir. Bildiren kişi her adımda bilgilendirilir. İsterse düzeltmeden sonra teşekkür sayfasında adı yer alır. Para ödülü (bug bounty) şimdilik yok.

## Güvenli liman

Bu politikaya iyi niyetle uyan araştırmayı izinli sayarız; araştırmacı hakkında şikâyette bulunmaz, dava açmayız. Bu taahhüt yalnızca Quant Dijital'i bağlar; kamu makamlarının yetkilerini ve yasal bildirim yükümlülüklerimizi (KVKK) etkilemez.

_Neden bu biçimde (iç not, yayımlanmaz):_
- Bilişim suçlarının (TCK 243–245) bir kısmı şikâyete bağlı değil; savcılık kendiliğinden soruşturabilir. "Şikâyet etmeyiz" sözü bizi bağlar, devleti bağlamaz. Bu yüzden taslaktaki "kolluğa iletilmez" sözü çıkarıldı.
- Araştırmacı gerçek kişisel veriye eriştiyse bu bir veri ihlalidir; 72 saatlik Kurul bildirimi (docs/runbooks/veri-ihlali.md) bu maddeden bağımsız sürer.
- Verinin sorumlusu mağazadır; platform yalnızca kendi adına söz verebilir.
- Avukat bulunduğunda bu madde ona gösterilir (docs/12).

## İç süreç

1. Bildirim `guvenlik@quantdijital.com` adresine, güvenlik sorumlusuna gelir (kişi ve yedeği F16'da veri ihlali rol tablosuyla birlikte yazılır).
2. Kişisel veriye erişim varsa veri ihlali runbook'u (`docs/runbooks/veri-ihlali.md`) aynı gün başlar.
3. Düzeltme, testiyle birlikte birleştirilir. Etkilenen her tenant'a dağıtılır (instance-per-tenant: hepsine aynı sürüm).
4. Kapanışta ADR ya da `docs/04`'e ders notu yazılır.
