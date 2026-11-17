# CLAUDE.md — E-Ticaret Altyapı Platformu

> Bu dosya kısa tutulur. Detaylar `docs/` altındadır; sadece görevle ilgili dosyayı oku.

## Proje nedir
Çok müşterili (multi-tenant) bir e-ticaret **altyapı platformu**. Medusa.js v2 tabanlı backend + admin.
Sektörden bağımsızdır; ilk müşteri bıçak sektöründen ama **hiçbir kod sektöre özel yazılmaz** —
sektörel ihtiyaçlar feature flag ve attribute şablonlarıyla çözülür.
Model: **instance-per-tenant** (her müşteriye ayrı Medusa instance + ayrı DB).

## Şu anki odak
F18 vitrin (`apps/storefront`, Next.js; tema sözleşmesi `packages/ui`, tek ve varsayılan tema Atölye `packages/themes/atolye`, yön "Grafit" `design.md`; adr/0046, adr/0057), kullanıcının 2026-11-01 isteğiyle F16'dan önce. Backend + kendi yönetici panelimiz (`apps/panel`, adr/0022) sürüyor; Medusa Admin'e yeni ekran yazılmaz. Ödeme deneme sayfası (adr/0028) vitrin ödemesi çalışınca silindi (2026-11-02); ödeme `localhost:8000/odeme`.
Güncel faz ve görevler: `PROGRESS.md`

## Stack
- Medusa.js v2 (Node.js, TypeScript strict), PostgreSQL, Redis
- pnpm workspaces + Turborepo monorepo
- Panel: React 19 + Vite, Tailwind v4 + shadcn/ui, TanStack Router/Query/Table, RHF + Zod (docs/18)
- Test: Vitest/Jest (Medusa test-utils), entegrasyon testleri zorunlu

## Komutlar
- `pnpm dev` — tüm uygulamalar
- `pnpm --filter backend dev` — sadece backend
- `pnpm --filter panel dev` — panel (backend'e proxy)
- `pnpm --filter storefront dev` — vitrin `localhost:8000` (backend açık ve `seed:demo` yapılmış olmalı)
- `pnpm dev:paytr` — sahte PayTR (panelden test hesabıyla bağlanır); vitrin ödemesi `localhost:8000/odeme`
- `pnpm --filter backend test:unit` / `test:integration:http` / `test:integration:modules`
- `pnpm lint` / `pnpm typecheck` / `pnpm format`
- `pnpm verify:changed` — PR öncesi: değişen paketlerin typecheck/lint/test'i + değişen dosyalarda prettier (`origin/dev`'e göre)
- `pnpm lock:presets` — hazır görünüm kilidini bilerek yeniden yaz (docs/tema/bilesen-standardi.md §7; PR'da etkilenen görünümleri yaz)
- `pnpm style:capture -- --out <klasör>` / `pnpm style:diff -- <eski> <yeni>` — çözülmüş stil denetimi (tema çizimine dokunan PR birleşmeden önce elle; sunucular açık olmalı; adr/0067 §3)
- `pnpm --filter backend medusa db:migrate` — migration
- `pnpm --filter backend medusa db:generate <modul>` — migration üret

## Altın kurallar
1. **Kod yazmadan önce** Medusa API'sini Context7 MCP ile doğrula. Hafızandan Medusa v1 API'si yazma.
2. Medusa çekirdeğini değiştirme. Her şey modül, module provider, workflow, subscriber, API route; arayüz panel ekranı.
3. İş mantığı **workflow**'larda; API route'lar ince kalır (doğrula → workflow çağır → dön).
4. Dış servis çağıran her adımın **compensation**'ı olur.
5. Fiyat/tutar istemciden asla kabul edilmez; sunucuda hesaplanır.
6. Secret'lar koda, loga, test fixture'ına girmez. `.env*` dosyalarını okuma.
7. Dosya başına ~300 satır üst sınır. Büyüyorsa böl.
8. Ödeme, kargo, fatura modüllerinde test olmadan PR yok.
9. Türkçe UI metinleri i18n anahtarlarıyla; kod, değişken, commit İngilizce.
10. Belirsizlikte varsayım yapma, sor. Mimari karar gerekiyorsa `adr/` altına ADR öner.
11. SEO çekirdek özelliktir: katalog/içerik dokunan her görevde `seo` payload, slug/301 ve advisor etkisi düşünülür (docs/13, docs/14).
12. Güvenlik tabanı (`lib/security`, rate limit, redaksiyon) F2'de hazırdır; sonraki fazlarda bunlar kullanılır, yeniden yazılmaz (docs/04).

## Doküman haritası
| Konu | Dosya |
|---|---|
| Mimari, tenant modeli | docs/01-mimari.md |
| Klasör yapısı | docs/02-klasor-yapisi.md |
| Yol haritası + kabul kriterleri | docs/03-yol-haritasi.md |
| Güvenlik | docs/04-guvenlik.md |
| Performans | docs/05-performans.md |
| Panel UX ve ekran planı | docs/06-admin-ux.md |
| Panel tasarım sistemi (token, tema, klasör) | docs/18-panel-tasarim-sistemi.md |
| Panel kullanılabilirlik denetimi | docs/17-yonetici-paneli-kullanilabilirlik.md |
| Test | docs/07-test-stratejisi.md |
| DevOps | docs/08-devops.md |
| Claude Code çalışma düzeni, MCP | docs/09-claude-code-is-akisi.md |
| Kod standartları | docs/10-kod-standartlari.md |
| Kod dışı gereksinimler (hukuk, mali, sağlayıcı) | docs/12-kod-disi-gereksinimler.md |
| KVKK veri envanteri ve saklama süreleri | docs/kvkk-envanter.md |
| SEO mimarisi (URL, 301, JSON-LD, sitemap, GEO) | docs/13-seo-mimarisi.md |
| SEO advisor kural seti ve öneri motoru | docs/14-seo-advisor-kural-seti.md |
| Rakip analizi ve farklılaşma | docs/15-rakip-analizi-ve-farklilasma.md |
| Platform eksik analizi (Shopify, ikas, TR; gerekli/faydalı/gereksiz) | docs/20-platform-eksik-analizi.md |
| Vitrin performans ölçümü (Lighthouse, CWV, düzeltme listesi) | docs/21-vitrin-performans-olcumu.md |
| Yapay zekâ çekirdeği uygulama planı (servisler, işler, PR sırası) | docs/22-yapay-zeka-uygulama-plani.md |
| Entegrasyonlar | docs/entegrasyonlar/*.md |

## Ortak çalışma (iki geliştirici: Deniz, Oğuzhan)
- **Dallar:** `dev` ortak ve varsayılan dal; `main` canlı sürüm (yalnız `dev`'den). Her iş `dev`'den açılan kısa ömürlü dalda: `deniz/<konu>`, `oguzhan/<konu>`; 1–3 günde PR ile `dev`'e girer, sonra silinir. `dev`'e doğrudan commit yok, hiçbir dala force push yok.
- **Çakışmayı küçük tut:** işe başlarken ve PR açmadan önce `git pull --rebase origin dev`. Alanlar ağırlık merkezidir, kilit değildir (Deniz: backend, üst panel, `infra/`, F16; Oğuzhan: tema ve vitrin): ikisi de her alanda çalışabilir. Başkasının alanına ya da açık PR'ının dokunduğu dosyalara gireceksen önce `git fetch` ile dallarına ve açık PR'larına bak, PR'ında ona not düş.
- **Aynı işi iki kez yapma:** bir özelliğe başlamadan önce `git fetch --prune origin` ile diğerinin dallarına (`origin/deniz/*`, `origin/oguzhan/*`: son commit'ler ve `git diff --stat origin/dev...<dal>` ile dokunduğu dosyalar), açık PR'larına ve `progress/<kişi>.md` dosyasının en üstündeki sıradaki işlerine bak; açık PR listesi tek başına yetmez, PR açılmadan dalda çalışılıyor olabilir. Aynı işe ya da aynı dosyalara giriyorsan başlamadan haber ver (PR'ına, PR yoksa kendi PR'ında ona not); küçük iş büyük olanın üstüne oturtulur. Kendi işini de görünür tut: dalı ilk commit'le hemen push et, sıradaki işlerini `progress/<kişi>.md` en üstünde güncel tut. Uzun oturumda ara ara yeniden bak.
- **Yayımlanmış biçim sözleşmedir:** `dev`'e girmiş bir bölüm biçiminin (variant) çizimi yerinde yeniden tasarlanmaz; onu kullanan kayıtlı görünümler (hazır görünümler ve mağazaların kendi düzenleri) habersiz değişmesin. Yeni tasarım ya **ayar** olarak gelir (fark küçükse: şerit aç/kapat, genişlik, kutulu/çizgili, gölge; varsayılan bugünkü görünümü korur) ya da **yeni biçim** olarak (düzenin iskeleti değişiyorsa). Hazır görünüm yalnız veridir (`layout.json`: bölüm, biçim, ayar değerleri); içine kod ya da gizli CSS girmez, görünüm ayarlarla kurulamıyorsa eksik olan ayardır. Yerinde değiştirilebilenler: hata düzeltmesi, erişilebilirlik, performans, görünümü değiştirmeyen iç düzenleme. Ölçüt: bu biçimi seçmiş mağaza sahibi farkı görür ve itiraz edebilir mi; evetse seçenek olur. Bir fark nereye yazılır: görünüş (gölge, kenarlık, köşe) stil takımı basamağına; tek davranış (alt menü aşağı/yana açılır) bölüm ayarına; iskeletin bütünü yeni biçime. Alanların anlamı değişmez, yeni anlam yeni alan olur. Hakem görünüm kilidi testidir, onay beklenmez. Tam kural: adr/0066; ayrıntı: docs/tema/bilesen-standardi.md §7.
- **Kim olduğun:** `git config user.name` (Deniz → `progress/deniz.md`, Oğuzhan → `progress/oguzhan.md`).
- **PROGRESS:** oturum notu yalnız kendi `progress/<kişi>.md` dosyana, en üste. `PROGRESS.md` ortak durumdur (aktif faz, sıradaki görev, açık sorular, faz durumu); yalnız bunlar değişince dokunulur.
- **ADR:** numara önce `adr/README.md`'de ayrılır ve hemen `dev`'e push edilir; sonra ADR kendi dalında yazılır.
- **Migration:** aynı modülün migration'ını aynı anda tek kişi üretir; birleştirmede migration adlarının benzersizliği kontrol edilir.
- **Çeviri dosyaları:** yeni anahtar kendi bölümünün altına; çakışmada iki tarafın satırları da tutulur.
- **`pnpm-lock.yaml`:** paket eklemeyi haber ver; çakışırsa elle düzeltme, `pnpm install` ile yeniden üret. Yeni ortam değişkeni `.env.example`'a yazılır.
- **PR:** GitHub Actions her push'ta koşar (CI ve Security; yalnız belge değişince CI atlanır); PR, denetimler yeşil olunca birleşir. Kararsız bir test düşerse günlüğüne bakılır ve yeniden koşulur; gerçek kırılma düzeltilir. Yerelde hızlı ön denetim olarak `pnpm verify:changed` önerilir (sonucunu PR'a yazmak zorunlu değil). **PR'ı açan birleştirir; kimse kimsenin onayını beklemez** (sahip kararı 2026-11-15). Ödeme, auth, migration ya da güvenlik dokunan PR birleşmeden önce: (1) `security-reviewer` (ve gerekiyorsa `code-reviewer`) çalıştırılır, bulgular ve nasıl kapatıldıkları PR'a yazılır; (2) ilgili testler koşulur, sonucu PR'a yazılır; (3) kapatılmamış ciddi bulgu varsa birleşmez. Birleşince diğerine PR'da haber notu düşülür; o isterse sonradan bakar, bulgu çıkarsa ayrı düzeltme PR'ı açılır.

## Oturum düzeni
Oturum başı: `PROGRESS.md` ve kendi `progress/<kişi>.md` dosyanı oku → `dev`'i çek, iş dalı aç → tek görev seç → plan modu → onay → kodla → test → `/oturum-kapat`.
