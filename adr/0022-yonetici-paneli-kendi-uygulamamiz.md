# ADR-0022: Yönetici paneli kendi uygulamamızdır (Medusa Admin yerine)

- **Durum:** Kabul edildi (2026-10-25, kullanıcı kararı)
- **Tarih:** 2026-10-25

## Bağlam

- Bugüne kadar yönetici paneli Medusa Admin'di; biz içine widget, sayfa ve ayar ekranı ekliyorduk (docs/06'nın eski hâli, adr/0021). Bu, hız için verilmiş bir karardı.
- Kullanıcı 2026-10-25'te paneli gördü: "aynı içerik, aynı UI, tek renk, dashboard yok, her şey düz kartlar; bir e-ticaret firmasının paneli gibi olmalı, adım adım ilerleyen akışlar olmalı". Haklı: Medusa Admin'in teması, kabuğu, ürün formu ve sipariş ekranları değiştirilemez; açılış sayfası bile sabittir (docs/17 §2). Kutunun içinde kalarak hedeflenen deneyime ulaşmak mümkün değil.
- Hedef kitle teknik olmayan mağaza sahibi; çok müşterili bir platformda panel ürünün yüzüdür. Rakipler (docs/15: ikas "modern panel") burada yarışıyor.
- Medusa Admin'i kapatmak teknik olarak tek ayardır (`admin.disable`); API'ler, giriş ve motor aynen kalır.

## Karar

1. **Panel bizim uygulamamızdır:** `apps/panel`, ayrı bir React SPA. Medusa'nın Admin API'si ve bizim `/admin/*` uçlarımızla konuşur. Tasarım sistemi, tema, dashboard, sihirbazlar ve ekranlar bizimdir (docs/18).
2. **Bugünden itibaren yeni hiçbir ekran Medusa Admin'e yazılmaz.** Fazların "admin widget / ayar sayfası" maddeleri panel ekranı olarak teslim edilir. Mevcut Medusa Admin eklentilerimiz (Başlangıç, ayar sayfaları, iki ürün kutusu, çekirdek metin ezmeleri, adr/0021 düzeni) panelde karşılığı yazılana kadar kalır, sonra silinir.
3. **Medusa Admin saklanır, mağaza sahibine gösterilmez.** Platform ekibi, panelde henüz olmayan işler için `/app`'i kullanır. Panel sipariş operasyonunu da karşıladığında (F7 sonrası) Medusa Admin tenant'larda kapatılır.
4. **Aynı origin:** Panel statik dosyadır ve backend'le aynı host'tan sunulur (dev: Vite proxy; prod: F16 reverse proxy). Böylece CORS yok, giriş mevcut oturum çereziyle, CSRF koruması (Origin) olduğu gibi çalışır. Panel, tenant başına bir kez dağıtılır; kontrol düzlemi (F17) sürümünü yönetir.
5. **Yığın:** React 19 + Vite + TypeScript strict; Tailwind v4 + shadcn/ui (bileşen kodu bizde); TanStack Router, Query, Table; React Hook Form + Zod; Recharts; i18next (tr varsayılan); Vitest + Testing Library; Playwright (e2e). Tam liste ve sürümler docs/18.
6. **Tema mağaza sahibi tarafından yönetilir:** marka rengi, logo, köşe yuvarlaklığı, yoğunluk, açık/koyu mod ayarlardan değişir; panel bütün ölçeği bu girdilerden türetir ve kontrastı garanti eder (docs/18 §5). Değerler `platform-settings` `appearance` bölümünde durur.
7. **Yol haritası:** Panel ayrı bir iş hattıdır (`P` dilimleri, docs/03). P1 temel (tasarım sistemi, kabuk, giriş, dashboard, görünüm ayarı), sonra yolculuklar. F3 backend'i paralel sürer.

## Alternatifler

| Seçenek                                       | Artı                                                | Eksi                                                                                  |
| --------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Kendi panel (karar)**                       | Tam kontrol; tek görsel dil; white-label; mobil     | Büyük iş; Medusa'nın hazır ekranları yeniden yazılır; her faz ekranını da teslim eder |
| Medusa Admin + rehberli katman                | Ucuz                                                | Yama görünümü; çekirdek ekranlar gri ve teknik kalır; açılış sayfası değişmez          |
| Medusa Admin'i fork'lamak                     | Hazır ekranlar                                      | Altın kural 2'ye aykırı; her yükseltmede birleştirme yükü                             |
| Panel ayrı host'ta, bearer token ile          | Tek panel, çok tenant                               | Tarayıcıda token saklama; CORS; CSRF modeli değişir; F17 zaten sürüm dağıtıyor        |

## Sonuçlar

- docs/06 baştan yazıldı (panel ilkeleri); docs/18 tasarım sistemi; docs/02'ye `apps/panel`; docs/03'e panel hattı. CLAUDE.md odak ve yığın satırları güncellendi.
- Medusa Admin'e yapılan yatırımın küçük kısmı (adr/0021 çekirdek metin ezmeleri, menü düzeni) panel tamamlanınca gereksizleşir; dashboard hata cümleleri (adr/0021 §4) panel için de gerekli kalır, çünkü panel de `message`'ı gösterir.
- `@medusajs/js-sdk` ve `@medusajs/types` sürümleri backend'le birlikte yükseltilir.
- Playwright e2e altyapısı panelle birlikte kurulur (PROGRESS'teki açık karar kapanır).
- Her yeni ekran docs/06 kontrol listesinden ve tasarım sistemi kurallarından geçer; "AI slop" kara listesi (docs/18 §3) inceleme ölçütüdür.
