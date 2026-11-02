# 14 — SEO Advisor: Kural Seti ve Öneri Motoru

> Hedef: tenant bir ürün, kategori veya sayfa kaydettiği anda "ne eksik, neden önemli, nasıl düzeltilir" görsün;
> tek tıkla düzeltebilsin; paylaşmadan önce önizlesin. Mimari karar: `adr/0005` (kural motoru birincil, LLM opsiyonel).
> SEO mimarisi: `docs/13-seo-mimarisi.md`. Rakiplerde doğrulanmış bir eşdeğeri yok (`docs/15`); bu modül ana farklılaştırıcılardan biridir.

## 1. Mimari (`seo-advisor` modülü)
- **Tetikleyiciler**
  - Varlık kaydı (ürün, varyant, kategori, marka, koleksiyon, içerik sayfası, blog, facet landing): workflow sonrası senkron değerlendirme, hedef < 50 ms (20 varyant, 10 görsel).
  - Gece denetimi (job, worker): mağaza geneli kurallar + tüm varlıkların yeniden puanlanması (kural sürümü değiştiyse) → rapor (F2.8 asenkron iş altyapısı).
  - İstek üzerine: admin "yeniden değerlendir" (tekil/toplu).
- **Veri modeli**
  - `seo_assessment`: entity_type, entity_id, score (0–100), grade, issues (jsonb), rules_version, computed_at. Unique (entity_type, entity_id).
  - `seo_audit_run`: started_at, finished_at, summary (jsonb: sayaçlar, dağılım), report_url (S3).
  - `seo_not_found_hit`: path, hit_count, last_seen_at, referer_host, suggested_target, status (open/redirected/ignored).
- **Bulgu biçimi**
  ```ts
  interface SeoIssue {
    ruleId: string                       // "P-TITLE-01"
    severity: "critical" | "high" | "medium" | "low" | "info"
    messageKey: string                   // i18n: başlık, "neden önemli", "nasıl düzeltilir"
    params: Record<string, string | number>
    fix?: { kind: "auto" | "suggest" | "manual"; payload?: unknown }   // auto: tek tık uygular
  }
  ```
- Kurallar sürümlenir (`rules_version`), her kuralın birim testi ve i18n metni vardır. Kural eklemek = dosya eklemek (`rules/<alan>/<id>.ts`).
- Store API'ye hiçbir değerlendirme sızmaz; yalnızca admin API (`/admin/seo/...`).
- Sektör nötr: kural metinleri attribute şablonundan etiket alır ("Çelik tipi alanı boş" gibi metin şablondan üretilir, kodda sektör yok).

## 2. Puanlama
Kategori ağırlıkları (claude-seo e-ticaret puanlamasıyla hizalı):
| Kategori | Ağırlık | Kapsam |
|---|---|---|
| Yapılandırılmış veri tamlığı | 25 | JSON-LD için gerekli alanlar: GTIN/MPN/marka, fiyat, stok, kargo, iade, puan |
| Başlık ve meta | 15 | Uzunluk, benzersizlik, marka, odak kelime |
| Görseller | 20 | Sayı, alt metin, boyut, ağırlık, dosya adı |
| İçerik | 20 | Uzunluk, özgünlük, yapı, özellik tablosu, okunabilirlik |
| İç bağlantı | 10 | Kategori, marka, ilgili ürünler, öksüz olmama |
| Teknik | 10 | Slug, canonical, robots, birincil kategori, ölçü/ağırlık |

- Skor = 100 − Σ(bulgu ağırlığı); kritik bulgu kategori puanını sıfırlar. Formül dokümante ve deterministiktir (aynı girdi → aynı skor).
- Notlar: 90+ "mükemmel", 70–89 "iyi", 50–69 "geliştirilmeli", < 50 "zayıf".
- **Yayın kapısı** (flag `seo_publish_gate`, tenant ayarı): eşik altındaki ürün yayına alınırken uyarı (varsayılan) veya engel (opsiyonel). Kritik bulgular (fiyat 0, görsel yok) her zaman engeller.

## 3. Kural kataloğu
Önem: K kritik · Y yüksek · O orta · D düşük · B bilgi. "Oto" = tek tıkla otomatik düzeltme var.

### 3.1 Ürün — başlık, meta, slug
| ID | Kural | Önem | Oto |
|---|---|---|---|
| P-TITLE-01 | SEO başlığı 30–60 karakter (piksel tahmini ile; Türkçe geniş karakterler hesaba katılır) | Y | Şablondan üret |
| P-TITLE-02 | Başlık mağazada benzersiz | Y | Attribute ekleyerek ayrıştır |
| P-TITLE-03 | Tamamı büyük harf / tekrarlı kelime / sembol yığını yok | O | Normalize et |
| P-TITLE-04 | Marka adı başlıkta (marka tanımlıysa) | D | Şablon |
| P-META-01 | Açıklama 70–155 karakter | O | Şablondan üret |
| P-META-02 | Açıklama benzersiz | O | |
| P-META-03 | Açıklamada fayda + fiyat/kargo ipucu + çağrı (bilgi) | B | Öneri |
| P-SLUG-01 | Slug ≤ 80 karakter, yalnız `[a-z0-9-]`, sayı-only değil | Y | Addan üret |
| P-SLUG-02 | Slug ürün adının anlamlı kelimelerini içeriyor | O | Addan üret |
| P-KW-01 | Odak anahtar kelime (girildiyse) başlık, meta ve ilk 100 kelimede | O | Öneri |
| P-KW-02 | Odak kelime adayları: ad + attribute + arama terimleri raporu (F11) | B | Öneri |

### 3.2 Ürün — içerik
| ID | Kural | Önem | Oto |
|---|---|---|---|
| P-CONT-01 | Açıklama ≥ 150 kelime (tenant ayarı; öneri 200) | Y | Taslak iskelet (başlıklar: Özellikler, Kullanım, Bakım, Teknik Özellikler, Kutu İçeriği) |
| P-CONT-02 | Açıklama mağazadaki başka ürünle %80+ benzer değil (shingle benzerliği) | Y | |
| P-CONT-03 | Teknik özellikler tablosu dolu (attribute şablonundaki zorunlu alanlar) | Y | Eksik alan listesi |
| P-CONT-04 | Başlık hiyerarşisi: açıklamada H1 yok (H1 ürün adıdır), H2/H3 düzenli | O | Dönüştür |
| P-CONT-05 | Paragraflar 2–4 cümle, ortalama cümle ≤ 20 kelime (okunabilirlik) | D | |
| P-CONT-06 | Kampanya/abartı yığını yok ("en ucuz", "!!!"), fiyat metin içine gömülü değil | D | |
| P-CONT-07 | Açıklamada bozuk bağlantı / http (karışık içerik) yok | O | https'e çevir |
| P-CONT-08 | İlk 60 kelimede ürünün ne olduğu net (AI arama alıntı bloğu) | B | Öneri |

### 3.3 Ürün — görseller
| ID | Kural | Önem | Oto |
|---|---|---|---|
| P-IMG-01 | En az 1 görsel (kritik), hedef ≥ 3 | K / O | |
| P-IMG-02 | Her görselde alt metin | Y | `{ad} {varyant/attribute} - {sıra}` şablonu |
| P-IMG-03 | Alt metinler birbirinin kopyası değil | D | Şablon |
| P-IMG-04 | Ana görsel ≥ 800×800 (Google Alışveriş) | Y | |
| P-IMG-05 | Görsel ≤ 300 KB türev (worker üretir) | O | Yeniden kodla |
| P-IMG-06 | Dosya adı slug'dan (generic `IMG_0001` değil) | D | Yeniden adlandır |
| P-IMG-07 | Varyant görseli eksik (renk gibi görsel seçeneklerde) | O | |

### 3.4 Ürün — veri ve şema
| ID | Kural | Önem | Oto |
|---|---|---|---|
| P-DATA-01 | Fiyat > 0 ve para birimi | K | |
| P-DATA-02 | GTIN (EAN/UPC) veya MPN + marka (Merchant Center uygunluğu, `gtin13` kontrol basamağı doğrulanır) | Y | |
| P-DATA-03 | Marka atanmış | O | |
| P-DATA-04 | Kategori atanmış ve birincil kategori seçili | Y | En derin kategoriyi seç |
| P-DATA-05 | Fiziksel üründe ağırlık/ölçü (kargo hesabı + `shippingDetails`) | Y | |
| P-DATA-06 | Ürün durumu (`itemCondition`) | D | Varsayılan "yeni" |
| P-SCHEMA-01 | Üretilen JSON-LD şema doğrulamasından geçiyor | K | |
| P-SCHEMA-02 | `aggregateRating` yalnızca onaylı yorum varken | O | |
| P-SCHEMA-03 | Kargo ve iade politikası tanımlı (mağaza geneli; yoksa S-POLICY-01) | O | |
| P-SCHEMA-04 | Kısıtlı/yetişkin kategoride `hasAdultConsideration` | Y | Flag'den |

### 3.5 Ürün — iç bağlantı
| ID | Kural | Önem | Oto |
|---|---|---|---|
| P-LINK-01 | Ürün en az bir kategoride (öksüz değil) | Y | |
| P-LINK-02 | İlgili ürün önerisi üretilebiliyor (aynı kategori/marka/attribute'ta ≥ 3 ürün) | D | |
| P-LINK-03 | Marka sayfası bağlantısı | D | |

### 3.6 Kategori, marka, koleksiyon
| ID | Kural | Önem |
|---|---|---|
| C-CONT-01 | Kategori açıklaması ≥ 100 kelime (üst bölüm kısa + alt bölüm uzun) | O |
| C-EMPTY-01 | Boş kategori yayında (noindex/404 ayarı uyarısı) | Y |
| C-DEPTH-01 | Derinlik ≤ 3 (daha derin yapı uyarı) | D |
| C-TITLE-01/02 | Başlık uzunluk + benzersizlik | Y |
| C-IMG-01 | Kategori görseli/OG görseli | D |
| B-* | Marka: açıklama, logo, başlık (aynı kurallar) | O |

### 3.7 Facet landing ve programatik sayfalar
F3.16'da uygulandı (`lib/seo/advisor/rules-landing.ts`). Özgünlük her metnin 5 kelimelik dizilerinin MinHash imzasıyla ölçülür (`lib/content/originality.ts`); facet ve kategori adları önce yer tutucuya çevrilir. Sayfanın, metni kendisinden önce yayına girmiş canlı landing'lerden en çok benzediğiyle ortak payı düşülür: metnin sahibi onu ilk yayına alandır, sonradan kopyalayan sayfa orijinali düşürmez. Kayıtta ve her gece yeniden hesaplanır.

Ad değişiklikleri (panel kuralı adının son kısmından tanır): L-EMPTY-01 → L-PRODUCTS-01 (EMPTY-01 liste sayfalarında "ürün yok" demek), L-CONT-01 → L-TEXT-01 (CONT-01 metni ürün açıklaması için yazılmış).

| ID | Kural | Önem |
|---|---|---|
| L-UNIQ-01 | Diğer landing sayfalarıyla özgün içerik ≥ %40 (< %30 yayın engeli, kayıtta reddedilir) | K |
| L-TEXT-01 | ≥ 300 kelime özgün metin | Y |
| L-BATCH-01 | Son 14 günde ≤ 100 yeni landing yayını; sonraki parti için 2 hafta bekleme önerisi | Y |
| L-REVIEW-01 | Son 14 günün partisinin ≥ %5'i "insan inceledi" işaretli (incelenmemiş sayfada uyarır) | O |
| L-PRODUCTS-01 | Landing'in ürün sayısı < 3 ise noindex önerisi (sayfa zaten noindex ise susar) | Y |

### 3.8 İçerik sayfaları ve blog
Kural adları ortak ve ürün kurallarıyla çakışmasın diye farklıdır (META-01, LINK-01, IMG-01 başka kuralların adı; panel kuralı adından tanır). F3.16'da uygulandı (`lib/seo/advisor/rules-content.ts`).

| ID | Kural | Önem |
|---|---|---|
| A-BYLINE-01 | Blog yazısında yazar (`Person`); yayın ve güncelleme tarihi kendiliğinden tutulur | O |
| A-STRUCT-01 | ≥ 300 kelimelik metinde H2 ara başlık; paragrafların en fazla üçte biri 4 cümleden uzun | O |
| A-ANSWER-01 | Blog yazısında ilk başlıktan önce 130–170 kelimelik kendi kendine yeten cevap bloğu | B |
| A-INLINK-01 | ≥ 300 kelimelik metinde her 1.000 kelimede en az 3 iç bağlantı (ürün/kategori bağlantısı ya da kartı) | O |
| A-STALE-01 | Yayındaki metin 180 günden uzun süredir güncellenmemişse "gözden geçir" hatırlatması | D |
| A-COVER-01 | En az bir görsel (kapak ya da metinde); her görselin alt metni | D |
| A-LEN-01 | ≥ 300 kelime | O |
| A-DETAIL-01 | Metinde mağazanın telefonu, WhatsApp numarası ya da e-postası elle yazılmışsa `{telefon}`, `{whatsapp}`, `{e_posta}` bilgi değişkeni önerisi: mağaza bilgisi değişince metin eskimez (adr/0048) | D |

### 3.9 Mağaza geneli (gece denetimi)
| ID | Kural | Önem |
|---|---|---|
| S-POLICY-01 | Kargo politikası, iade politikası (F13.1) ve künye (F13.9) tanımlı → `OnlineStore` ve Offer şemaları eksiksiz | Y |
| S-HOST-01 | Canonical host ayarlı; platform alt alan adı 301 yapıyor; staging indekslenmemiş | K |
| S-ROBOTS-01 | robots.txt önemli yolları engellemiyor; sitemap satırı var | K |
| S-SITEMAP-01 | Son üretim başarılı, hata yok, URL sayısı beklenenle uyumlu | Y |
| S-REDIR-01 | Zincir/döngü yok; 12 aydır isabetsiz kurallar listesi | O |
| S-404-01 | Son 7 günde ≥ 10 isabetli 404 yolları + önerilen hedef | Y |
| S-DUP-01 | Mükerrer başlık/açıklama sayısı ve listesi | Y |
| S-ORPHAN-01 | Kategorisiz ürün sayısı | Y |
| S-IMG-01 | Alt metinsiz görsel sayısı | O |
| S-GSC-01 | (F10.11) Sitemap'te olup indekslenmeyen URL'ler; tıklaması %30+ düşen sayfalar; gösterim yüksek CTR düşük sayfalar | Y |
| S-CWV-01 | (F10.11) CrUX p75 eşik dışı (LCP > 2,5 s, INP > 200 ms, CLS > 0,1) | Y |
| S-SOCIAL-01 | `sameAs` sosyal hesaplar, varsayılan OG görseli | D |
| S-SEARCH-01 | Dahili aramada çok aranan ama sonuçsuz terimler → içerik/ürün fırsatı | B |

### 3.10 Paylaşım kontrolleri (ürün/sayfa paylaşmadan önce)
| ID | Kural | Önem | Oto |
|---|---|---|---|
| SH-OG-01 | OG görseli var, 1200×630, ≤ 1 MB | Y | Ana görselden kırp |
| SH-OG-02 | OG başlık ≤ 60, açıklama ≤ 120 (WhatsApp/Instagram önizlemesi kesmez) | O | Kırp |
| SH-UTM-01 | Paylaşım bağlantısı UTM'li üretilir (kaynak/kanal seçimi) | B | Üret |
| SH-TEXT-01 | Paylaşım metni önerisi (ürün adı + öne çıkan 2 özellik + fiyat + bağlantı); LLM varsa alternatifler | B | Öneri |
| SH-PREVIEW | Google sonuç kartı, WhatsApp, Instagram/X kart önizlemesi admin'de | | |

## 4. Öneri üretimi (LLM'siz)
- **Başlık/meta şablonları** tenant ayarından; tokenlar: ürün adı, marka, öne çıkan attribute (şablonda "SEO'da öne çıkar" işaretli alan), fiyat cümlesi, kargo cümlesi, mağaza adı.
- **Açıklama iskeleti**: attribute şablonundan başlıklar ve tablo; tenant yalnızca boşlukları doldurur.
- **Alt metin**: ad + varyant seçenek değeri + sıra tanımı ("önden görünüm", "detay").
- **Odak kelime adayları**: ad kelimeleri + attribute değerleri + dahili arama terimleri (F11) + GSC sorguları (F10.11).
- **İç bağlantı adayları**: aynı kategori/marka/attribute; "birlikte alınanlar" (sipariş verisi, F11).
- **404 hedef önerisi**: Levenshtein/trigram benzerliği ile mevcut slug'lar, eski slug rezervleri, geçiş eşleme tablosu.
- **LLM taslakları** (F10.13, `adr/0005`): açıklama, meta, alt, Soru-Cevap taslağı, paylaşım metni; her çıktı kural motorundan geçer, "AI taslak" etiketiyle kaydedilir, insan onayı olmadan yayımlanmaz.

## 5. Admin deneyimi (F3.13, F12.10)
- **Ürün detay widget'ı:** skor halkası + nota göre renk, bulgu listesi (önem sırasıyla, "neden önemli" açılır metin), "Düzelt" düğmeleri, "Önizleme" sekmesi (SERP kartı, WhatsApp, Instagram/X).
- **Ürün listesi:** "SEO" sütunu (skor), filtre (< 70, kritik bulgu var), toplu işlemler: başlık şablonu uygula, alt metinleri doldur, birincil kategori ata.
- **SEO paneli (route):** mağaza skoru ve dağılım, en düşük 20 varlık, 404 isabetleri + "301 oluştur", zincir/döngü listesi, mükerrerler, öksüzler, GSC ve CWV kartları (F10.11), son denetim raporu indir.
- **Kurulum kontrol listesi (onboarding):** künye, iade/kargo politikası, canonical host, robots ön ayarı, varsayılan OG görseli, GSC bağlama, Merchant Center bağlama, IndexNow anahtarı. Eksik kaldıkça panelde görünür.
  - Uygulandı (F12.10, `GET /admin/seo/setup`, kurallar `lib/seo/setup-checklist.ts`): SEO sayfasının başında yalnızca eksik maddeler, her biri tamamlandığı ekrana bağlantıyla; hepsi bitince kart kalkar. Genel bakıştaki bekleyen işlerde "SEO kurulumunda eksik" sayısı (yalnızca şimdi yapılabilenler, ayar yetkisi olana).
  - robots maddesi: Googlebot ana sayfayı tarayabiliyor ve dosyada `Sitemap:` satırı var. Siteyi kapatan bir robots.txt maddeyi yeniden açar.
  - Paylaşım görseli: SEO ayarlarında mağaza geneli görsel (`default_og_image`, medya kütüphanesinden; kaydedilince gece temizliğinden korunur). Kendi görseli ve ana görseli olmayan sayfa bunu paylaşır.
  - Künye ve politikalar F13'ün ekranlarıyla tamamlanır; o zamana kadar madde "yakında" notuyla açık kalır ve bekleyen işler sayısına girmez. Google maddeleri platformun Google istemcisi yoksa yine sayılmaz.
- İçe aktarmada (F3.9) satır bazlı ön değerlendirme: dosya yüklenince "bu dosyadaki ürünlerin %40'ında görsel yok" gibi özet.
- Tüm metinler i18n; terim sözlüğü `docs/06`.

## 6. Test ve performans
- Her kural: TR fixture'larıyla pozitif/negatif birim testi; kural sürümü değişince skor değişiklikleri snapshot testiyle görünür.
- Belirlenimcilik: aynı varlık iki kez değerlendirilince aynı skor.
- Performans: tekil değerlendirme < 50 ms (p95); 10.000 ürünlük gece denetimi < 5 dk (worker, toplu sorgu, `query.graph` dar `fields`).
- Mükerrerlik tespiti: shingle hash'leri önbellekte; O(n²) karşılaştırma yok (MinHash/LSH veya PostgreSQL trigram indeksi).

## 7. Yerel `/seo-*` skill'lerinin kullanımı
| Skill | Nerede |
|---|---|
| `seo-ecommerce` | Kural kataloğunun kaynağı (ürün sayfası kontrol listesi, şema puanlama); F3.13 kural tasarımında referans |
| `seo-schema` | F3.12 JSON-LD üreticisinin doğrulama kuralları; F18'de demo mağaza sayfalarını doğrulama |
| `seo-technical` | F3.15 robots/canonical kuralları, F18'de teknik denetim; AI tarayıcı listesi |
| `seo-programmatic` | F3.16 facet landing kalite kapıları (özgünlük eşikleri, parti boyutu) |
| `seo-geo` | F3.16 içerik editörü yapı kuralları ve robots ön ayarları |
| `seo-sitemap`, `seo-audit`, `seo-page` | F14 geçiş öncesi eski site envanteri; F18 demo mağaza tam denetimi; canlı tenant'larda dönemsel kontrol |
