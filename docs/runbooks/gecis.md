# Mağaza geçişi (eski platformdan Quant Ticaret'e)

> Karar: ADR-0042. Panel: Ayarlar > Taşıma (yalnızca mağaza sahibi). Bu sayfa geçişi yürüten ekip
> içindir; mağaza sahibiyle birlikte izlenir. Mağazanın hiçbir parolası, anahtarı ya da müşteri
> dosyası sohbete, e-postaya veya depoya konmaz.

## Kaynaklar

| Eski platform                       | Panelde seçilen kaynak    | Taşınanlar                                                                                   |
| ----------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------- |
| Shopify                             | Shopify                   | Ürünler ve varyantlar, koleksiyonlar (kategori), satıcılar (marka), görseller, müşteriler, geçmiş siparişler, sayfalar ve blog yazılarının adresleri |
| WordPress + WooCommerce            | WordPress                 | Dışa aktarma dosyası (WXR): kategoriler, markalar, ürünler ve varyasyonlar, görseller, yorumlar, blog yazıları (kategori ve etiketleriyle), içerik sayfaları, hepsinin eski adresleri |
| Ticimax, ikas, IdeaSoft, T-Soft vb. | Ürün akışı                | Google Merchant XML akışındaki ürünler, varyantlar, kategori yolları, markalar, görseller, eski ürün adresleri |
| Aynı platformlar (müşteriler)       | Müşteri listesi           | Platformun müşteri dışa aktarması (xlsx/CSV): ad, e-posta, telefon, adres, tarihli izinler  |
| Başka her şey (yorumlar, siparişler) | Geçiş paketi              | Ekibin hazırladığı JSON (ortak kayıtlar; `apps/backend/src/lib/migration/sources/bundle.ts`) |

Shopify için ayrıntı: `docs/entegrasyonlar/shopify.md`; WordPress için `docs/entegrasyonlar/wordpress.md`. Paket biçimi ve eşleme kuralları: ADR-0042 uygulama notları.

## Bilinmesi gerekenler

- **Fiyatlar çevrilmez.** Kaynak Türk lirası dışında satıyorsa taşıma reddedilir.
- **Üstü çizili fiyat taşınmaz.** İndirim öncesi fiyat son 30 günün en düşük fiyatı olmalı; fiyat geçmişi taşımayla başlar.
- **Ölçüsü olmayan ürün.** Yayındaki yeni ürün ağırlık ve ölçü ister. Varsayılan paket verilmezse ürün taslak gelir ve sayfası açılmaz. Kesimden önce ya varsayılan paket verilir ya ölçüler girilir.
- **Şifreler taşınmaz.** Müşterilere hesap açma daveti gider (aşağıda).
- **İleti izinleri.** Yalnızca kaynak tarihiyle veriyorsa taşınır; İYS'ye bildirilir.
- **Tekrarsızlık.** Her çalıştırma kaynak kayıtlarını kimlikleriyle hatırlar; yeniden çalıştırmak hiçbir şeyi iki kez yazmaz. Yarıda kalan bir çalıştırma aynen yeniden başlatılır.
- **Taşınmış ürün yeniden yazılmaz.** Yeniden çalıştırma yalnızca yeni ürünleri ekler; bir kez taşınmış ürünün fiyatı, stoku ve durumu buradaki hâliyle kalır. Bu yüzden ana uygulamadan sonra ürün değişiklikleri eski platformda değil, burada yapılır.
- **Tanıtıcı çakışması.** Sitede aynı tanıtıcılı başka bir ürün varsa (elle eklenmiş) kaynaktaki ürün taşınmaz, raporun Notlar sayfasında yazar; üzerine asla yazılmaz.

## WordPress'ten gelen mağaza

1. Sahip WordPress'te **Araçlar > Dışa aktar > Tüm içerik** dosyasını indirir ve Taşıma'da **WordPress** kaynağına yükler (50 MB'a kadar; büyükse zip). Dosya sohbete, e-postaya ya da depoya konmaz: yazarların ve yorumcuların e-postası içindedir. Taşıma işi dosyayı bitince siler.
2. Müşteriler ve geçmiş siparişler dosyada yoktur: WooCommerce > Müşteriler'in CSV dışa aktarması **Müşteri listesi** kaynağıyla ayrıca yüklenir.
3. WooCommerce ürünlerinde ağırlık ve ölçü çoğu zaman girilmemiştir: kuru çalıştırmada "ölçüsüz, taslak gelecek" notları çoksa varsayılan paket verilir.
4. Kuru çalıştırmanın Notlar sayfasında beklenenler: yasal metinler ve sepet/ödeme/hesap sayfaları "yalnızca eski adres" (Eski adresler'de `/yasal/...`'a ya da ilgili sayfaya 301), menüler ve kuponlar "taşınmadı" (Vitrin > Menüler, Kampanyalar'dan elle), ürün etiketleri ve açıklayıcı özellikler "taşınmadı" (özellik şablonu kurulunca), yazı içindeki görseller (içerik düzenleyicide eklenir).
5. Kategori eski adresleri raporda yanlış tabanla görünürse (ör. `/product-category/...` ama site `/urun-kategori/...` kullanıyorsa) kategori adres tabanı elle verilip kuru çalıştırma tekrarlanır.
6. Geliştirme ortamında bir dosyanın kuru çalıştırması: `NODE_ENV=development pnpm --filter @qticaret/backend medusa exec ./src/scripts/wordpress-check.ts <dosya.xml>` (yalnızca kuru çalıştırma; özet kişi verisi içermez).

## Kesimden 2 hafta önce

1. Mağazanın genel ayarları tamam: mağaza adı, iletişim, ödeme ve kargo hesapları, yasal metinler (F13), SEO ayarlarında kanonik alan adı (`canonical_host`, davet bağlantıları buna göre kurulur).
2. Kaynağı bağlayın ya da dosyayı hazırlayın; **kuru çalıştırın**. Raporun üç sayfası var:
   - **Özet:** tür başına kaynakta, eklenecek, var olan, atlanacak.
   - **Ürünler:** katalog içe aktarmanın satır satır sonucu (tanıtıcıya göre).
   - **Notlar:** atlanan kayıtlar ve nedenleri (geçersiz e-posta, para birimi, ölçüsüz ürün, görsel indirilemedi…).
3. Notlardaki sorunları kaynakta düzeltin ya da varsayılan paketi belirleyin; kuru çalıştırmayı sorun kalmayana kadar tekrarlayın.
4. **Uygulayın** (yeniden doğrulama ister). Sonra katalogu ve birkaç müşteriyi panelde gözle kontrol edin.

## Eski adresler (kesimden 1 hafta önce)

1. Ayarlar > Taşıma > Eski adresler'de **site haritası adresini** okutun (`https://eski-magaza.com/sitemap.xml`; dizin haritaları ve `.gz` desteklenir).
2. Search Console'da **Performans > Sonuçlar > Dışa aktar > CSV** ile son 3 ayın sayfalarını indirip **Search Console dosyası** olarak yükleyin (zip olduğu gibi).
3. Tabloda **Karar bekleyen** sekmesini açın: her adres için yönlendirilecek sayfayı (sitede yayında olmalı) ya da 410'u seçin. **Sorgu dizeli** adresler (`/urun.php?id=12`) platform kuralıyla yönlendirilemez: sunucu ya da CDN kuralı gerekir; karar verince "görüldü" sayılır.
4. **Kararları uygula.** Taşınan kayıtların eski yolları kayıtlarına bağlanır (ürünün adresi sonra değişse de 301 doğru yere gider); kararlarınız 301/410 kuralı olarak yazılır.
5. Rozet **Kesime hazır** olana kadar 3–4. adımları tekrarlayın: Search Console'un en çok tıklanan ilk 100 adresinin hepsi yanıt vermeli.

## Kesim günü

1. Eski platformda yeni sipariş ve yeni üye almayı durdurun (bakım modu ya da duyuru). Dondurma süresi kısa tutulur (birkaç saat).
2. Ana uygulamadan bu yana eski platformda açılan yeni ürünleri, müşterileri ve siparişleri almak için taşımayı **bir kez daha uygulayın**: yalnızca yeni kayıtlar yazılır (taşınmış ürünlere dokunulmaz).
3. Eski adresleri bir kez daha **uygulayın**; **Kesime hazır** olduğunu görün.
4. Alan adının DNS kaydını yeni siteye yöneltin (TTL'i bir gün önceden 300 saniyeye indirin). SSL sertifikasının yeni sitede hazır olduğunu doğrulayın.
5. Yeni sitede birkaç eski adresi tarayıcıda açın: 301 ile doğru sayfaya gitmeli.
6. Panelde **Kesim yapıldı**'ya basın: 30 günlük 404 izlemesi başlar.
7. Search Console'da yeni site haritasını gönderin; alan adı değiştiyse "Adres değişikliği" aracını kullanın.
8. Hazırsanız **Davetleri başlat**: taşınan müşterilere hesap açma e-postası gider (günlük e-posta sınırının yarısı kadar, her gün; siparişler kalan payı kullanır). Davet, 60 gün geçerli kişisel bir anahtar taşır: müşteri bu bağlantıyla hesabını açınca (ya da açık hesabıyla girince) eski siparişleri, adresleri ve yorumları hesabına geçer. Anahtarsız giriş taşınan veriyi almaz (güvenlik).

## Kesimden sonra (30 gün)

- Her sabah vitrinin yeni 404'leri eski adreslere eklenir ve zil çalar. Ayarlar > Taşıma > Eski adresler'de kararı verip uygulayın.
- Davetlerin ilerleyişini Müşteri davetleri kartından izleyin.
- Search Console'da Kapsam ve 404 raporlarını haftalık kontrol edin; trafik düşüşü eski adres kararlarıyla karşılaştırılır.

## Geri dönüş

- DNS'i eski platforma geri yöneltmek tek başına yeterlidir; eski platform kesim günü kapatılmaz, en az 30 gün açık tutulur.
- Yeni sitede kesimden sonra alınan siparişler eski platforma taşınmaz: geri dönüş kararı verilirse bunlar elle aktarılır. Bu yüzden geri dönüş kararı ilk 24 saatte verilir.

## Doğrulama listesi

- [ ] Kuru çalıştırma raporunda Notlar sayfası boş ya da her satırın nedeni biliniyor.
- [ ] Ürün sayısı kaynaktakiyle (taslaklar dahil) eşleşiyor; ölçüsüz taslak kalmadı.
- [ ] Rastgele 10 ürünün fiyatı, varyantları ve görselleri kaynakla aynı.
- [ ] Müşteri sayısı (geçersiz e-postalar hariç) ve izinli müşteri sayısı makul.
- [ ] Kesime hazır rozeti yeşil; sorgu dizeli adresler için sunucu kuralı yazıldı ya da kabul edildi.
- [ ] Kesimden sonra 3 eski adres tarayıcıda 301 veriyor.
- [ ] Davetler başladı; ilk gün gönderilen sayısı beklenen.
