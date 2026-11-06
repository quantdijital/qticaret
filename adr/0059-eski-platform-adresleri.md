# ADR-0059: Eski platformun kendi adresleri (WordPress)

- **Durum:** Kabul edildi (2026-11-06, otonom; ana oturumun önerisiyle, gözden geçir)
- **Tarih:** 2026-11-06
- **İlgili:** adr/0017 (yönlendirme motoru), adr/0042 Ek 2026-11-03 (WordPress kaynağı) ve Ek 2026-11-05 §5 (hâlâ 301'i olmayan sınıflar), docs/13 §2.2, §4, §7, §12

## Bağlam

- WordPress + WooCommerce'tan taşınan mağazada kayıtların eski yolları URL kaydında ayrılmış durur (338 yol 301'e bağlandı). WordPress'in kayıt olmayan kendi adresleri ise 404 veriyordu: sayfalama (`/x/page/2/`, `?paged=2`), kökte çağrılan alt kategori (`/tavalar/` ↔ `/mutfak/tavalar/`), ürün etiketi, blog etiketi, tarih ve yazar arşivleri, `?p=12` gibi kimlikli adresler, ortam kütüphanesi (`/wp-content/uploads/…`), beslemeler, `wp-login.php`, WooCommerce'un sepet, ödeme ve hesap sayfaları.
- Bunların bir kısmı sonludur ve taşıma onları bilir (alt kategoriler, taşınan görseller); bir kısmı açık uçludur (her sayfa numarası, her tarih, her besleme, sorgu dizeli adres). Sorgu dizeli adres kural olamaz (G5a §4).
- Seçenekler: (a) her şeyi `seo_redirect` satırı olarak yazmak, (b) kod içinde kalıp kuralları, (c) karışık.

## Karar

Karışık (c), sektörden bağımsız, yalnız WordPress taşıması uygulanmış mağazada (`migration_run.source` `wordpress:%`, `mode: apply`; ayrı bayrak yok) açık:

1. **Açık kayıtlar (taşımada, sonlu küme):**
   - Alt kategorinin kısa yolu: kategorilerin eski yollarından okunur (ebeveynin yolu çocuğunkinin son bölümsüz hâli; taban kök ya da `/urun-kategori`). Kısa yol adres envanterine kategoriye bağlı girer, `reserveRecordPaths` onu kategori için ayırır: tam yol gibi kaydın bugünkü yoluna 301, kategori taşınsa da zincir yok. Envanterde zaten olan adrese (başka kaydın eski yolu) dokunulmaz.
   - Ortam kütüphanesi dosyası: yeni `migration_file` tablosu (`path`, `stem`, `media_id`). Taşınan her ürün görseli ve yazı/sayfa kapağı (kapaklar artık `image` taşıma kaydı olarak da hatırlanıyor) eski sitenin alan adındaysa yolu ve köküyle (`kapak-300x200.jpg`, `kapak-scaled.jpg`, `kapak.jpg.webp` → `…/kapak`) yazılır. Çözümleme tam yolu, yoksa aynı kökün dosyasını (aynı uzantı önce) bulur, medya varlığının kendi adresine 301 verir; varlık silindiyse ya da dosya hiç taşınmadıysa 410. Hedef kural tablosuna yazılmaz: kural hedefi site içi yol olmalı (açık yönlendirme yok); dosyanın adresi yalnız veritabanındaki medya varlığından gelir.
   - Kayıt `seo_redirect` değil: kısa yol kaydın kendisini izler (adr/0017 uygulama notu), dosya varlığı izler.
2. **Kalıp kuralları (kodda, açık uçlu küme):** `lib/seo/legacy/wordpress.ts` adresi sınıflar, `workflows/seo/redirects/legacy.ts` yanıtlar. Çözümlemede en sonda sorulur: canlı sayfa, kural ve ayrılmış yol hiç gölgelenmez.
   - Sayfalama (`…/page/N`, `?paged=N`, `?product-page=N`, `comment-page-N`): tabanı çözülür; liste o sayfaya sahipse `?sayfa=N`, değilse ilk sayfa. Sayfa sayısı listenin kendi sayımı (kategori/marka/koleksiyon/landing/`/magaza` 24, blog ve blog arşivleri 12). Tarih/yazar arşivinin sayfası ilk sayfaya gider.
   - Tarih (`/2024`, `/2024/05`, `/2024/05/12`, `?m=`) ve yazar (`/author/x`, `?author=`) arşivi → `/blog`.
   - Ürün etiketi (`/urun-etiketi/x`, `/product-tag/x`, `?product_tag=`) → `/arama?q=x` (etiketler taşınmaz). Taşınmamış blog etiketi ya da kategorisi (`/tag/x`, `/etiket/x`, `/category/…/x`) → aynı kısa adlı blog arşivi varsa o, yoksa `/blog`.
   - Kimlikli ve kısa adlı adresler (`?p=`, `?page_id=`, `?post_type=product&p=`, `?product=`, `?product_cat=`): taşıma kaydından kayda; kayıt canlıysa bugünkü yolu, değilse eski yolunun yanıtı; taslak 404, hiç taşınmamış kimlik 410. `?s=` → `/arama?q=`.
   - 410: `wp-admin`, `wp-includes`, `wp-json`, `wp-content` (uploads dışı), `wp-*.php`, `xmlrpc.php`, her besleme (`/feed`, `/x/feed/atom`, `?feed=`), `?attachment_id=`.
   - WooCommerce sayfaları (İngilizce ve Türkçe kısa adlar): sepet → `/sepet`, ödeme → `/sepet`, sipariş alındı → `/hesap/siparisler`, hesap uç noktaları → `/hesap/...`, `shop` → `/magaza`, istek listesi → `/hesap/favoriler`. `/sepet`, `/odeme`, `/magaza` zaten vitrinin.
3. **Sorgu dizesi (docs/13 §4, §7):** WordPress'in parametreleri (`p`, `paged`, `orderby`, `filter_*`…) atılır, ziyaretçininkiler (`utm_*`, `gclid`) korunur; sonuç vitrinin liste kanonik biçiminden geçer (tek atlama).
4. **Tek atlama:** vitrin vekilinde sondaki eğik çizgi ya da büyük harfli eski adres önce temiz biçimiyle çözülür, yönlendirme varsa doğrudan oraya gider (`/x/page/2/` → `/kategori/x?sayfa=2`, iki 301 değil). Ana sayfa ve vitrinin listeleri yalnız eski platformun sorgusuyla (`/?p=12`, `/blog?paged=2`) sorulur; onlar için 404 bildirilmez.
5. **Envanter:** sorgulu adres (`/?p=12`) yolu ve sorgusuyla değerlendirilir; kalıp kuralının yanıtladığı karar bekleyen adres "karşılanıyor" sayılır. Kayda bağlı ya da sahibin karar verdiği satır kalıp kurallarından bağımsız değerlendirilir (kaydın yolu ayrılır, sahibin 301/410'u yazılır).
6. **Geriye dönük:** `pnpm --filter @qticaret/backend legacy:backfill <wxr> [apply]` (varsayılan kuru: yazmaz, sayar). Önce dışa aktarmadaki kapakları hatırlar, sonra kısa yolları ve dosyaları yazar, `apply` ile kısa yolları hemen ayırır; denetim kaydı `migration.legacy_addresses_recorded`.

## Alternatifler

- **Hepsi kural satırı:** sayfalama kategori × sayfa sayısı kadar satır olurdu ve sayfa aralığı yazıldığı anda donardı; tarih, besleme ve sorgulu adres için hiç olamaz. Reddedildi.
- **Hepsi kod:** dosya ve alt kategori eşlemesi taşımanın bildiği veriye dayanır; her istekte taşıma kaydında metin araması hem yavaş hem kırılgan olurdu. Reddedildi.
- **Mağazaya özel kurallar (mylarte):** sektör ve müşteri bağımsızlığı kuralına aykırı. Reddedildi.

## Sonuçlar

- Yeni migration: `migration` modülünde `Migration20261106171523` (`migration_file`).
- Kalıp kuralları yalnız 404 olacak istekte bir sorgu daha yapar (WordPress taşıması var mı; çözümleme önbelleğiyle). Shopify gibi başka bir kaynak aynı yapıya kendi sınıflayıcısıyla eklenir.
- Testler: birim `lib/seo/legacy/__tests__/{wordpress,files}.unit.spec.ts`, `workflows/migration/__tests__/legacy-addresses.unit.spec.ts`; HTTP `seo-legacy-paths.spec.ts`; vitrin `src/__tests__/proxy-legacy.spec.ts`, `lib/seo/__tests__/paths.spec.ts`.

## Ek (2026-11-06): Ek sayfaları ve temiz olmayan 410

İlk sürümün açık bıraktığı iki şey:

1. **WordPress ek sayfaları (attachment pages)** 404 veriyordu: yüklenen dosyanın bağlandığı kaydın altındaki kendi sayfası (`/urun/dokum-tava/tava/`, `/tava-bakimi/kapak/`; kaydın kalıcı bağlantısı gerektirdiğinde `/tava-bakimi/attachment/kapak/`). Karar:
   - WordPress'in kendi adres sınıflarından hiçbiri tutmadığında en son sorulur (`lib/seo/legacy/attachments.ts` biçimi okur, `workflows/seo/redirects/legacy-attachment.ts` yanıtlar). Adres en az iki bölümlüdür, son bölüm kısa ad biçimindedir; ebeveyn son bölümsüz hâlidir (önünde `attachment` varsa o da düşer).
   - Ebeveyn, eski platform kuralları olmadan bir kez çözülür (iç içe çağrı yok): canlı kayıtsa yolu, yönlendiriyorsa gittiği yer. Oradaki kayıt WordPress taşımasından gelmiş (`migration_item` `done`) canlı bir **ürün, yazı ya da sayfa** ise ek sayfası kaydın bugünkü sayfasına tek 301 alır; ziyaretçinin sorgusu korunur, WordPress'inki atılır.
   - Ek sayfasının kısa adı taşınmış bir dosyanın köküyle (`migration_file.stem`) eşleşse de hedef kaydın sayfasıdır, görsel değil: ziyaretçi bir sayfa istiyordu. Dosya araması yapılmaz.
   - Ebeveyn kategori, marka, taşınmamış kayıt, kaldırılmış ya da bilinmeyen bir yolsa kural yanıt vermez: adres eskisi gibi 404 kalır. `?attachment_id=N` 410 kalır (hangi kayda bağlı olduğu bilinmiyor).
   - Gölgeleme yok: canlı sayfa, gerçek iç içe kategori yolu, kural ve ayrılmış yol önce yanıtlar; bu kural yalnız hiçbir şeyin yanıtlamadığı adreste sorulur. Aynı biçimdeki kaydın alt uç noktaları (`/yazi/embed`, `/yazi/amp`, `/yazi/trackback`) da kaydın sayfasına gider.
2. **Temiz olmayan 410:** sondaki eğik çizgili ya da büyük harfli eski adres 410'a çözülüyorsa (`/wp-login.php/`, `/Feed/`) vitrin vekili önce temiz biçimine 301 veriyordu, sonra 410. Artık 301 hedefinde olduğu gibi tek atlama: vekil temiz biçimi çözer, `gone` gelirse bakım kapısından ve sayfa başlıklarından sonra doğrudan temanın kaldırıldı sayfasıyla 410 döner (adres tarayıcıda olduğu gibi kalır). Bulunamayan temiz olmayan adres eskisi gibi temiz biçimine 301 alır.

Testler: birim `lib/seo/legacy/__tests__/attachments.unit.spec.ts`, `workflows/seo/redirects/__tests__/legacy-attachment.unit.spec.ts`; HTTP `seo-legacy-paths.spec.ts` (ek sayfaları, kategori altında ve taşınmamış kayıtta yanıt yok); vitrin `src/__tests__/proxy-legacy.spec.ts` (temiz olmayan 410 tek atlama).
