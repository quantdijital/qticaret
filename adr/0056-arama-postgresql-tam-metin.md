# ADR-0056: Site araması ve listeler PostgreSQL tam metin ile

- **Durum:** Kabul edildi (2026-11-03, kullanıcı: "postgresql tam metin ile ilerle gerek yok diğerlerine. kaliteli sağlam ilerleyelim.")
- **Tarih:** 2026-11-03
- **Yerine geçtiği:** adr/0046 eki (2026-11-03) "bellekte yazım toleranslı arama"; docs/20 D10 (Meilisearch) kalıcı olarak kapandı.

## Bağlam

- Arama (`/arama`) ve tüm listeler (`/magaza`, kategori, marka, koleksiyon, landing, `/kampanyalar`) bellekte çalışıyordu: liste başına en çok 3000 ürün okunuyor, filtre/facet/sıralama Node'da yapılıyordu. 3000+ ürünlü listede ilk 3000 görünüyordu.
- Meilisearch D10'a ertelenmişti. Kullanıcı 2026-11-03'te dış arama servisini tamamen kapattı: PostgreSQL tam metin; hız değil kalite ve sağlamlık.

## Karar

### Modül: `search-index` (yeni)

- `search-terms` analitik (sorgu sayıları, 180 gün saklama). İndeks kataloğun türetilmiş kopyası; yaşam döngüsü, yazanı ve okuyanı farklı. Ayrı modül.
- Eklentiler: `unaccent`, `pg_trgm`. İkisi de PostgreSQL 13+'ta "trusted": veritabanının sahibi süper kullanıcı olmadan kurar (`CREATE EXTENSION IF NOT EXISTS`, migration `Migration20261103195501`).
- Tablolar (ORM varlığı yok; yalnız modülün kendi SQL'i yazar ve okur):
  - `search_document`: ürün başına bir satır.
    - `document tsvector`, `STORAGE MAIN` (satırda, sıkıştırılmış). Her arama ürün başına birkaç kez okur; geniş JSON sütunları onu satır dışına iterse her okuma TOAST parçalarını yeniden getirir. Ölçüldü: 10.000 üründe kapsamlı sorguda tampon okuması 90 bin → 2,5 bin.
    - Liste olguları: `published`, `sales_channel_ids[]`, `category_ids[]` (gizliler dahil tüm kategoriler), `categories` (gösterilenler, adlarıyla; arama çipleri), `collection_id`, `brand_id/handle/name`, `options[]` (`anahtar=değer`), `prices` (`region_id:para_birimi` → en düşük satış fiyatı), `in_stock`, `popularity`, `product_created_at`.
    - Kaynak metin `fields` (JSON) ve `vocabulary`: yapılandırma değişince vektör katalog okunmadan yeniden kurulur; geri alma (compensation) eski satırı birebir yazar.
    - İndeksler: `document` GIN, `category_ids` GIN, `options` GIN, `brand_id`, `collection_id`.
  - `search_word`: yayındaki ürünlerin kelime sözlüğü (karşılaştırma biçimi, katalogdaki yazılışı — başlıktaki yazılış öncelikli —, başlık ve ürün sayısı). Rakam içermeyen kelimelere kısmi GIN trigram indeksi (`gin_trgm_ops`). Kodlar yazım hatasının komşusu olmaz.
  - `search_pending`: yeniden indekslenecek ürünler kuyruğu (`version`, `claimed_at`).
  - `search_synonym` (DML modeli): eş anlamlı grupları.

### Metin: iki biçim tek vektörde

- Ağırlıklar: A başlık + SKU/barkod/EAN/UPC/MPN; B marka + gösterilen kategoriler; C alt başlık, açık nitelik değerleri (`textOf`: "Paslanmaz Çelik", "20 cm"), seçenek değerleri, varyant adları, etiketler, tür; D düz açıklama (ilk 4000 karakter, etiketsiz). Her alan bir kelimeyi bir kez tutar (yirmi "Kırmızı" varyant bir sayılır).
- Her kelime iki kez yazılır:
  - **Karşılaştırma biçimi** (`simple`): Türkçe küçük harf, işaretsiz (`bıçağı` → `bicagi`), JS'te (`lib/search/normalize.ts`). Veritabanının yerel ayarına bağlı değil. Tam kelime, önek ve kod eşleşmesi bununla.
  - **Türkçe kök** (`turkish` yapılandırması, sonra `unaccent`): kök işaretli metinden çıkar (Snowball Türkçesi işaretle doğru çalışır: `bıçağı`, `bıçakları` → `bıçak`), sonra işaret atılır (`bicak`). Kökler `~` ile işaretlenir (`~bicak`): bir kelimenin öneki köke değmez. SQL işlevleri `search_index_stems`, `search_index_document`.
- Kodlar ayrıca ayraçsız yazılır: `KUPA-MAVI-01` → `kupa mavi 01 kupamavi01`.
- **Neden iki sütun değil tek vektör:** brief `simple` için ayrı sütun öneriyordu. Tek vektörde bir birimin kelime ve kök yolları aynı `tsquery`'de `|` ile durur. "Biri hariç hepsi" kuralı tek ifade olur ve tek GIN indeksinden okunur. İki sütunda kural, sütunlar arası `OR`'ların `AND`'leri olarak büyür (8 kelimede 112 koşul).

### Sorgu

- Sorgu kelimeleri (en çok 8, bağlaçlar atılır) birimlere okunur. Mağazanın eş anlamlı terimi (1–3 kelime) yan yana geçiyorsa tek birimdir.
- **`websearch_to_tsquery('turkish', unaccent(q))` kullanılmadı:** işaretsiz yazılan kelimeyi yanlış kökler (`bicagi` → `bicagı`), birim başına önek/yazım hatası/eş anlamlı yolu kuramaz, kullanıcı sözdizimi (`-`, `"..."`, `or`) vitrinde istenmiyor. Yerine her birimin yolları `tsquery` olarak kurulur. Her sözcük tırnaklıdır ve değer bağlı parametredir (`?::tsquery`); SQL metnine girdi yazılmaz.
- Bir birimin yolları ve ağırlıkları (`lib/search/levels.ts`):
  1. Kelimenin kendisi: 1.
  2. Türkçe kökü: 0,9.
  3. Eş anlamlısı: 0,8. Çok kelimeli terim yan yana (`'t' <-> 'shirt'`), ağırlığı kelime sayısına bölünür: `ts_rank` yan yana iki kelimeye tek kelimeden fazla verir (ölçüldü: 1,63), terim kelimenin kendisini geçmemeli.
  4. Son kelimenin öneki (yazarken arama): 0,7.
  5. Kelimenin başladığı katalog kelimesi (en az 4 harf ve yarısı; kökleyicinin kaçırdığı ek: `kupalar` → `kupa`): 0,6.
  6. Yazım hatası: 0,5 × benzerlik.
- **Bulma kuralı (eskisiyle aynı):** bir ya da iki birimlik sorguda hepsi, daha uzunda biri hariç hepsi. Tek `tsquery`, GIN'den okunur.
- **Yazım toleransı:**
  - İlk geçiş yazım hatası yolu olmadan çalışır. Üçten az sonuç bulursa (`FEW_RESULTS`) ikinci geçiş, kelimelerin trigram komşularıyla tekrar arar.
  - Komşular `search_word`'den `pg_trgm` benzerliğiyle gelir, her kelime için en yakın 4. Eşik (Jaccard) 5+ harfte 0,25, 3–4 harfte 1/3 (eski Dice 0,4 / 0,5'in karşılığı). 3 harften kısa ve rakamlı kelimede yazım hatası yok.
  - Her kelimenin komşu sorgusu kendi değeriyle planlanır; planlayıcı trigram indeksini kullanır.
- **"Bunu mu demek istediniz":** eski davranış korundu.
  - Bir kelime hiçbir yolla (kendisi, kökü, öneki, başladığı kelime, eş anlamlı) hiçbir üründe yoksa zayıftır.
  - Zayıf kelime için başlık kelimelerinden en benzer 3'ü önerilir: önce benzerlik, sonra başlık sayısı.
  - Bilinen kelime katalogdaki yazılışıyla gösterilir (`sef` → `şef`). Öneri ancak bir ürün tüm kelimelerini taşıyorsa sunulur. En çok 5.

### Sıralama

```
skor = (Σ birim skoru × bulunan / birim + başlık bonusu) × (1 + popülerlik)
birim skoru = max(yol ağırlığı × ts_rank({0.15,0.35,0.65,1}, document, yol) × π²/6)
başlık bonusu = +1 başlık sorgunun kendisi; +0,7 başlık sorguyu bir kelime başından tutuyor
popülerlik = min(0,3; 0,1 × ln(1 + son 30 günün sipariş sayısı))
sıra: stokta olan önce, sonra skor, sonra yeni, sonra id
```

- **`ts_rank`, `ts_rank_cd` değil.** Brief `ts_rank_cd` diyordu. Ölçüm (PostgreSQL 16.15, 6.947 eşleşen ürün, tek terim): `ts_rank_cd` 149 ms, `ts_rank` 14 ms.
  - Her birim tek başına sıralanır (bir kelime ve biçimleri): kapsama yoğunluğunun katkısı yok.
  - Yakınlığı başlık bonusu taşır. `ts_rank` tekrarı alt-doğrusal sayar; anahtar kelime doldurmaya dayanıklı.
  - `ts_rank` eşleşmeyen ürüne 0 değil 1e-20 verir: "bulunan birim" sayımı 1e-6 eşiğiyle yapılır (en küçük gerçek yol ~0,01).
- Alan ağırlıkları: başlıktaki kelime ≈ 3 nitelik değeri; açıklama en az. Testte sıra başlık > kategori > seçenek > açıklama.
- Seçili sıralama (`yeni`, `fiyat-artan`, `fiyat-azalan`) skoru yok sayar. Liste varsayılanı en yeni; arama varsayılanı yukarıdaki sıra.

### Filtreler, facet'ler, sayfalama — tek SQL

- Bir liste ya da arama tek ifadedir (`modules/search-index/sql/listing.ts`):
  - `m` (MATERIALIZED): kapsamdaki, yayında, alışverişçinin kanalındaki, eşleşen ürünler skorlarıyla.
  - `f`: her filtre bir kez hesaplanır.
  - Ardından sayfa (`LIMIT/OFFSET`), toplam, marka sayıları (marka filtresi hariç), her filtrelenen niteliğin kendi değerleri (kendisi hariç), diğer niteliklerin sayıları, stok sayısı (stok filtresi hariç) ve fiyat aralığı (fiyat filtresi hariç). Aramada ilgili kategori/marka çipleri ilk 48 isabetten.
- **3000 sınırı kalktı**, tüm liste türleri için. Kategori kapsamı her istekte gösterilen alt ağaçtan; kampanya ürünleri 30 sn bölge başına önbellekte (fiyat listeleri ve 30 gün kuralı).
- **Yeni filtre `stok=var`:** yalnız stokta olanlar. URL dilbilgisinde nitelik anahtarları arasında (`lib/seo/facets.ts`). Ayrılmış anahtar: `stok` adlı nitelik URL filtresi olamaz. robots.txt `stok`'u da kapatır.
- Listenin çözümü (`/store/seo/resolve`, son sayfa ve boş filtre 404) sayıyı aynı ifadeden alır. İndeks her değiştiğinde çözüm önbelleği unutulur.
- Fiyat bölge ve para birimi başına, müşteri grubu olmayan alışverişçi için. Eski davranışla aynı.

### Eş anlamlılar

- `search_synonym`: grup başına 2–10 terim, terim 1–3 kelime, her terim karşılaştırma biçimine göre bir kez. Mağaza başına en çok 1000 grup.
- Grup iki yönlüdür. PostgreSQL thesaurus dosyası kullanılmaz (sunucu dosyası ister).
- Admin uçları (katalog ayarı: sahip ve yönetici yazar, diğerleri okur; denetim kaydı terimleri önce/sonra yazar):
  - `GET /admin/search/synonyms?q=&offset=&limit=`
  - `POST /admin/search/synonyms` `{ terms: string[] }`
  - `POST /admin/search/synonyms/:id`
  - `DELETE /admin/search/synonyms/:id`
- Yazma workflow'dadır (`saveSynonymWorkflow`, kilitli). Adımlar geri alınabilir.
- Vitrin tarafı süreç içi önbellek (`createVersionedCache`). Yazınca Redis işaretiyle her süreç yeniden okur, en geç 60 sn.

### İndeksin bakımı

- **Olaylar → kuyruk → boşaltma.** Abone (`subscribers/search-index.ts`) yalnız ürün id'lerini `search_pending`'e yazar ve sürecin boşaltmasını başlatır. Katalog yazımı indeksi beklemez, indeks hatası yazımı bozmaz.
- **Boşaltma (`workflows/search/drain.ts`):**
  - 200'lük partiler hâlinde `reindexSearchProductsWorkflow` çalıştırır: oku → yaz (compensation: eski satırlar geri, yeniler silinir) → çözüm önbelleğini unut.
  - Süreçler arası `FOR UPDATE SKIP LOCKED` ile talep eder. Talep sırasında yeniden işaretlenen ürün sürümüyle kalır, tekrar indekslenir.
  - Başarısız parti ürün ürün denenir; bozuk ürün yalnız kendini bekletir.
  - 5 dk'dan eski talep (duran süreç) dakikalık işte yeniden alınır.
- **Dinlenen olaylar:**
  - `product.*`, `product-variant.*`, `product-category.updated|deleted`
  - `brand.saved|deleted`
  - `pricing.price.*`, `pricing.price-list.*`, `pricing.price-list-rule.*`
  - `inventory-level.*`, `reservation-item.*`
  - `region.created|updated` (tüm katalog)
  - Yeni `catalog.product_saved` olayı: Medusa'nın olay yaymadığı yazımlar için `setProductBrandWorkflow`, `upsertProductAttributesWorkflow`, `setProductCatalogWorkflow` yayar.
- **İçe aktarma:** WordPress, Shopify ve tablo içe aktarması ürünü `importProductWorkflow` ile yazar (`runImport` kancaları). İç içe workflow'ların olayları ürün başına ilgili ürünü kuyruğa koyar; katalog satır başına taranmaz, kuyruk tekrarı birleştirir.
- **Dakikalık iş (`search-index-minute`):**
  - Başlayan/biten fiyat listelerinin ürünleri (olay yok).
  - Kalmış talepler.
  - İndeksi hiç kurulmamış mağazada ilk kurulum (migration sonrası ilk açılış).
- **Gece işi (`search-index-nightly`, 04:10):**
  - Son 30 günün popülerliği yeniden sayılır (iptal, taslak, arşiv hariç).
  - Tüm ürünler yeniden indekslenir (kaçan olay, şablon değişikliği, satış kanalı bağı).
  - Sözlük sayıları kesinleşir, eski kelimeler düşer.
- `pnpm --filter @qticaret/backend search:rebuild`: aynısı, elle.
- **Popülerlik:** `order.placed` siparişin ürünlerine anında +1 yazar (geri alınabilir adım). Ürün görüntülenmesi platformda izlenmiyor.
- **Yorum değişikliği tetiklemez:** yorum metni aranmaz, puan sıralamaya girmez (eski ürünü kayırır).

### Analitik

- `search-terms` aynı: yeni arama, sıfır sonuçlu arama.
- Seçilen sonuç/tıklama eklenmedi: vitrin bunu bildirmiyor (kontrol edildi), vitrin değişikliği bu işin dışında.

## Performans (§Performans)

- **Ölçüm:** `integration-tests/http/search-performance.spec.ts`. 10.000 sentetik ürün, store ucu üzerinden uçtan uca, 2 ısınma + 9 çalıştırmanın medyanı. Yerel makine (Apple Silicon), PostgreSQL 16.15 (docker), son çalıştırma, makinede başka test yükü varken.

| Sorgu | Eşleşen | Medyan (HTTP) |
|---|---|---|
| `seramik kupa` (facet'li) | 35 | 19 ms |
| `kupa` + renk, fiyat, `stok=var`, fiyat sıralı | 188 | 17 ms |
| `seramk kupa` (yazım hatası, ikinci geçiş) | 352 | 28 ms |
| `dayanıklı` (açıklama kelimesi, kapsamlı) | 6.793 | 34 ms |
| `/magaza` tüm katalog, facet'li | 9.794 | 23 ms |

- **Bütçe:** facet'li arama < 150 ms. Testte iddia edilir.
- Parçalar (`seramik kupa`): kelime analizi 3,1 ms, liste ifadesi 3,0 ms.
- İndeks yazımı ~0,34 sn / 1000 ürün (servis yazımı, katalog okuması hariç).
- Bir arama 3–5 sorgu atar: eş anlamlılar önbellekten, analiz, liste (gerekirse ikinci geçiş), bilinen kelime denetimi, gerekirse öneri denetimi.
- **Ana sorgunun planı** (`seramik kupa`, `EXPLAIN (ANALYZE, BUFFERS)`, özet):

```
Result (actual time=1.944..1.947 rows=1) Buffers: shared hit=480
  CTE m
    -> Nested Loop (actual time=1.562..1.632 rows=35)
         -> Bitmap Heap Scan on search_document d (rows=35)
              Recheck Cond: (document @@ '( 'seramik' | '~seramik' ) & ( 'kupa' | '~kup' | 'kupa':* )')
              Filter: (published AND (sales_channel_ids && $0))
              -> Bitmap Index Scan on "IDX_search_document_document" (rows=70) Buffers: shared hit=410
         -> Result (loops=35)            -- birim skorları, ürün başına bir kez (LATERAL ... OFFSET 0)
  CTE f -> CTE Scan on m (rows=35)
  CTE t -> Limit -> Sort -> WindowAgg   -- çipler için ilk 48
  InitPlan: count, sayfa (top-N heapsort), marka HashAggregate, seçenek unnest + HashAggregate,
            stok sayısı, fiyat aralığı, kategori/marka çipleri
Planning Time: 0.269 ms
Execution Time: 2.077 ms
```

- **Kapsamlı sorgu (`dayanıklı`, 6.793 ürün):** `m` sıralı tarama (seçicilik düşük), 23 ms. `ts_rank_cd` ve satır dışı vektörle ilk ölçüm 613 ms idi. İndeks yazmaları katalog yazımını hiç beklemez (olay yolu, boşaltma işçi sürecinde).

## Sonuçlar

- **Vitrin değişikliği gerekmez:** `GET /store/listings/products` sözleşmesi aynı.
- **Eklenen alan:** `facets.stock` `{ count, selected }`.
- **Eklenen sorgu değeri:** `query` içinde `stok=var`.
- Panel için yeni ekran: eş anlamlı grupları (yukarıdaki uçlar).
- **Riskler:**
  - Olay ile indeks arasında milisaniyeler var.
  - Sözlük sayıları gece kesinleşir. Yeni kelime yazımda hemen eklenir; silinen ürünün kelimesi gece düşer. Öneri yine de ürün denetiminden geçer.
  - Uzantı kurulumu veritabanı sahibinin `CREATE` yetkisini ister.
