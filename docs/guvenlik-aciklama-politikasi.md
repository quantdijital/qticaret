# Güvenlik açığı bildirme politikası (taslak)

> F15.9. Bu metin platformun ve mağazaların sitesinde `/.well-known/security.txt`'deki `Policy` bağlantısının gösterdiği sayfanın kaynağıdır. **Taslak:** iletişim adresi, süreler ve güvenli liman maddesi kullanıcının (ve gerekirse avukatın) onayını bekler.

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

- Adres: `security.txt`'deki `Contact` (ör. `guvenlik@<alan adı>`). **Kullanıcı belirleyecek.**
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

Bu politikaya iyi niyetle uyan araştırmacıya karşı hukuki yola başvurulmaz ve bildirim kolluğa iletilmez. **Avukat onayı gerekir** (docs/12): Türk Ceza Kanunu 243–245. maddeler ve KVKK'nın veri ihlali bildirimi yükümlülüğü (72 saat, docs/runbooks/veri-ihlali.md) ile birlikte değerlendirilmelidir.

## İç süreç

1. Bildirim, güvenlik sorumlusuna gelir (kişi ve yedeği: kullanıcı belirleyecek).
2. Kişisel veriye erişim varsa veri ihlali runbook'u (`docs/runbooks/veri-ihlali.md`) aynı gün başlar.
3. Düzeltme, testiyle birlikte birleştirilir. Etkilenen her tenant'a dağıtılır (instance-per-tenant: hepsine aynı sürüm).
4. Kapanışta ADR ya da `docs/04`'e ders notu yazılır.
