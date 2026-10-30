# Veri ihlali tatbikatları

> F13.10 (KK5). Masa başı tatbikat: gerçek sistemlere dokunulmaz. Katılımcılar senaryoyu adım adım konuşur ve `docs/runbooks/veri-ihlali.md` kılavuzuna göre ne yapacaklarını söyler. Amaç, kılavuzdaki eksikleri bulmaktır.
> Her tatbikatın kaydı bu klasöre `YYYY-MM-DD.md` olarak yazılır.

## Nasıl yapılır (yaklaşık 60 dakika)

1. Kolaylaştırıcı senaryoyu okur. Katılımcılar kılavuzu açık tutar.
2. Her "gelişme"de saat ilerletilir ve katılımcılara üç soru sorulur: Şimdi ne yapıyorsunuz? Kimi arıyorsunuz? Neyi kaydediyorsunuz?
3. Zaman tutulur: 24 ve 72 saatlik sınırlara göre nerede olunduğu not edilir.
4. Sonda bulunan eksikler kayda yazılır; her biri PROGRESS'e iş ya da kılavuza düzeltme olarak geçer.

## Senaryo 1: Ele geçirilmiş personel hesabı

- **T0 (Pazartesi 09:30):** Bir mağaza sahibi, panelde "Müşteriler" listesinin gece 03:00'te dışa aktarıldığını gösteren bir bildirim fark ettiğini söylüyor. Kimse böyle bir şey yapmadığını belirtiyor.
- **Gelişme 1 (10:15):** Denetim kaydında `operations` rolündeki bir personelin hesabından gece 02:40–03:10 arası 40 müşteri sayfası okuması ve bir sipariş listesi okuması var. IP adresi yurt dışı.
- **Gelişme 2 (11:00):** Personel, geçen hafta "kargo firması" görünümlü bir e-postadaki bağlantıya tıkladığını ve şifresini girdiğini hatırlıyor. Mağazada 2FA zorunlu değil.
- **Gelişme 3 (14:00):** Etkilenen kayıtlar: yaklaşık 1.200 müşterinin adı, e-postası, telefonu ve teslimat adresi. Vergi numaraları şifreli; anahtarın sızdığına dair bir bulgu yok.
- **Gelişme 4 (ertesi gün 10:00):** İki müşteri, mağaza adına gönderilmiş "siparişiniz iade edildi, kart bilgilerinizi girin" e-postası aldığını yazıyor.

**Tartışılacak:** sınırlama sırası (hesap, oturumlar, 2FA), kanıtın alınması, mağazaya bildirimin içeriği, 72 saatlik sürenin başlangıcı, müşterilere ne yazılacağı, oltalama uyarısı, kalıcı düzeltmeler (2FA zorunluluğu, operasyon rolünün okuma kapsamı).

## Senaryo 2: Yedeğin açıkta kalması (ikinci tatbikat için)

- **T0:** Barındırma sağlayıcısı, bir yedek klasörünün yanlış izinle 6 saat herkese açık kaldığını bildiriyor.
- **Sorular:** Yedekte hangi veriler vardı (envanter)? Şifreli alanlar ve anahtarın yeri? İndirildiğine dair kanıt var mı? Bildirim gerekir mi?

## Kayıt şablonu

```
# Tatbikat: <tarih>
- Senaryo:
- Kolaylaştırıcı:
- Katılımcılar (rol):
- Süre:

## Akış
| Gelişme | Verilen karar | Kılavuzda karşılığı var mıydı |
| --- | --- | --- |

## Süreler
- Sınırlamaya karar: T0 + ...
- Mağazaya bildirim taslağı hazır: T0 + ...
- Kurul bildirimi için bilgi tamam: T0 + ...

## Bulunan eksikler
1.

## Sonraki adımlar (PROGRESS satırı / kılavuz değişikliği)
1.
```
