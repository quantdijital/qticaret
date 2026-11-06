# ADR-0060: Blog yazarları

- **Durum:** Kabul edildi (2026-11-06, otonom; ana oturumun önerisiyle, gözden geçir)
- **Tarih:** 2026-11-06
- **İlgili:** adr/0019 (içerik, Ek 2026-11-03 blog kategorileri ve etiketleri), adr/0015 (SEO alanları), adr/0017 (301/410), adr/0046 Ek 2026-11-06 (sözleşme alanları), docs/13 §2.2 ve §5, docs/14 §3.8 A-BYLINE-01

## Bağlam

- Sahip (2026-11-06): "yazarı elle manuel yazmaktansa bir yazar sayfası olsun ve yazar oradan seçilebilsin."
- Yazının yazarı serbest metindi (`content_entry.author_name`). Aynı kişi farklı yazılabiliyordu; yazarın sayfası, fotoğrafı, unvanı yoktu. Yapılandırılmış veride `author` yalnız `{ "@type": "Person", name }` idi.
- Google, yazının yazarını bir yazar sayfasına bağlayan `Person` (`url`, `sameAs`) ve yazar sayfasında `ProfilePage` önerir; docs/13 §9 (E-E-A-T) yazar bilgisini ister.

## Karar

1. **Model (`content` modülü, kategori ve etiketlerin yanında):** `content_author` (`cauth_`): `name`, `handle` (tekil, silinmemişler arasında), `job_title`, `bio` (düz metin, boş satır paragraf ayırır, en çok 2000; kategorinin açıklaması gibi düz), `image_url` (medya kütüphanesinden; kapak gibi denetlenir ve "bağlı" işaretlenir), `website_url`, `linkedin_url`, `instagram_url`, `x_url` (https; profil bağlantısı ağın kendi alan adında: linkedin.com, instagram.com, x.com ya da twitter.com), `user_id` (isteğe bağlı personel hesabı; vitrine ve Store API'ye hiç çıkmaz). Yazı → yazar: `content_entry.author_id` (yazı başına en çok bir, boş olabilir). Aynı modülde olduğu için modül bağlantısı değil, sütun.
   - SEO alanları adr/0015 deseniyle: `content_author ↔ seo_meta` bağlantısı, `seo_meta.entity_type` değerlerine `post_author`. `PUT /admin/seo/post_author/:id` çalışır; panelde ayrı kart yok (pencerenin kendi "Kaydet"iyle karışırdı).
   - Migration'lar: `content` `Migration20261106071532`, `seoMeta` `Migration20261106071533`; bağlantı tablosu Medusa'nın bağlantı eşitlemesiyle.
2. **Adres (docs/13 §2.2):** `/blog/yazar/{handle}`, URL stilinden bağımsız. `url-registry` türü `post_author`. `/blog/yazar` ayrılmış yol: bu handle'la yazı açılamaz.
   - Handle addan; aynı ad ikinci kez `-2`, `-3`… alır; yazılan ve başka yazarda olan handle `content.author_handle_taken`.
   - Handle değişince eski yol, yazarın canlı yazısı varsa 301 için ayrılır; yoksa serbest kalır. Silinen yazarın canlı yazısı olduysa yolu 410, yoksa serbest (kategoriler gibi).
3. **İş kuralları (workflow):** `workflows/content/author-*.ts`. Kaydetme ve silme içerik kilidi altında; yol, fotoğraf ve kayıt telafiyle geri alınır; resolve önbelleği unutulur, vitrin yenilenir (yazıların yazar satırı ve yapılandırılmış verisi hemen değişir). Silme hiç engellenmez: yazıları yazarsız kalır (eski metinleri varsa o görünür). Yalnız yazı yazar alır (`content.author_post_only`); olmayan yazar `content.author_unknown`.
4. **Admin API:** `GET/POST /admin/content/authors`, `GET/POST/DELETE /admin/content/authors/:id` (yazı sayısı, canlı yazı sayısı, bağlı personel). `GET /admin/content?author_id=`. İçerik kaydı `author_id` alır ve `author_id` + `author` (`id`, `name`, `handle`, `path`) döner. Denetim kaydı `content_author` kaynağıyla (biyografi uzunluğuyla). İzin: içerik gibi, `operations` yazamaz.
5. **Store API:** liste ve okuma `author` taşır (listede kısa, okumada fotoğrafın boyu ve sürümleri, biyografi, bağlantılar); `author_name` artık bağlı yazarın adı, yoksa eski metin. `GET /store/content?kind=post&author={handle}` yazarın canlı yazıları (terimle birlikte istenirse boş). `GET /store/content/authors/:id` yazar sayfası (`post_count`).
6. **SEO (`/store/seo/resolve`, `entity_type: post_author`):** başlık yazı şablonuyla (`{başlık}` = ad); açıklama biyografi, yoksa "<ad> yazıları: …" (en yeni 5 canlı yazının başlıkları); iz Blog → yazar; canlı yazısı olmayan yazar `noindex,follow`. JSON-LD: `ProfilePage` (`mainEntity` `Person`: `name`, `url`, `jobTitle`, `image`, biyografinin ilk paragrafı `description`, `sameAs`) + `BreadcrumbList`. Yazıda `BlogPosting.author` aynı `Person` (yazar sayfası `url`'siyle); yazar seçilmemiş eski yazıda yalnız `name`.
   - **Site haritası:** `sitemap-blog-N.xml`'e en az bir canlı yazısı olan, noindex ya da başka kanonik işaretli olmayan yazarlar; SEO denetiminin beklenen sayısına da eklendi.
   - **Eski adresler (adr/0059):** WordPress'in `/author/{slug}` arşivi, aynı handle'lı yazar varsa onun sayfasına, yoksa `/blog`'a 301. Yazar sayfasının `?sayfa=N`'i blog listesi gibi 12'şer sayılır.
7. **SEO danışmanı (docs/14 A-BYLINE-01):** yazar seçilmemiş (`no_author`, orta), yalnız eski metin (`no_author_page`, düşük), yazarın biyografisi yok (`no_bio`, düşük).
8. **Eski serbest metin:** `author_name` silinmedi, yalnız okunur yedektir (panel artık göndermez; API hâlâ kabul eder). Sonraki bir temizlikte kaldırılacak.
9. **Veri taşıma:** migration'da değil, **`authors:backfill [apply]`** betiğinde (yazar yolu URL kaydına workflow'la girmeli; migration modüller arası çalışamaz). Ayrı adlar (boşluklar tekleşir, Türkçe küçük harfle karşılaştırılır) için birer yazar, aynı adlı yazar varsa o kullanılır; yazılar bağlanır; eski metin olduğu gibi kalır. `apply` olmadan hiçbir şey yazılmaz. Yeniden çalıştırmak güvenli. Uygulanınca denetim kaydı `content.authors_backfilled`. WordPress taşıması `author_name` yazmaya devam eder; taşımadan sonra betik çalıştırılır.

## Alternatifler

- **Ayrı `blog-authors` modülü:** yazıyla bağ modül bağlantısı olurdu; liste ve sayımlar için sorgu birleştirmesi gerekirdi. Kategoriler ve etiketler `content`'te; yazar da orada daha yalın.
- **Personel hesabını yazar saymak:** dış yazar (konuk, eski çalışan) olamazdı; personel adı ve e-postası vitrine yakınlaşırdı. Bağ isteğe bağlı tutuldu.
- **Backfill'i migration'da SQL ile yapmak:** yazar yolları URL kaydına girmez, sayfaları açılmazdı.

## Sonuçlar

- Yazar adı, fotoğrafı, unvanı, biyografisi ve profilleri vitrinde yayımlanır: kişisel veri, mağazanın yayımlama kararıyla (docs/kvkk-envanter). Personel bağı ve e-postası yayımlanmaz.
- Vitrin ve tema alanları isteğe bağlı (adr/0046 Ek 2026-11-06); okumayan tema eskisi gibi çizer.
- **Testler:** backend `workflows/content/__tests__/author-rules.unit.spec.ts`, `lib/seo/__tests__/resolve-author.unit.spec.ts`, `lib/seo/advisor/__tests__/rules-content.unit.spec.ts`, `lib/seo/legacy/__tests__/wordpress.unit.spec.ts`, HTTP `content-authors.spec.ts` (CRUD, handle ve 301/410, yazının yazarı, Store API, JSON-LD, site haritası, SEO alanları, backfill); panel `author-list.spec.tsx`, `content-summary-card.spec.tsx`, `content-list-page.spec.tsx`; vitrin adr/0046 Ek 2026-11-06'da.
