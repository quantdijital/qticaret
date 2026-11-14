# Oğuzhan — oturum notları

> Yalnız Oğuzhan'ın oturumlarının notları; en yeni en üstte. Ortak durum `PROGRESS.md`'de.

## 2026-11-14: Atölye tamamlama, Faz 1 ve Faz 2 başlangıcı

- **Plan:** `docs/tema/atolye-tamamlama-plani.md` (Faz 0–6, sahip kararları, ek istekler E1–E8, maket seçimi). Yeni tema yazılmıyor; Atölye tamamlanıyor, sonra aynı temadan hazır görünümler çıkıyor.
- **Biten:** Faz 0 (adr/0062, adr/0063), Faz 1 (Atölye bütün tema ayarlarını uygular; `dev`'de). Faz 2 iş 2.1 (tema ayarı ve menüler düzen taslağına, önizlemeye ve yayına girer) ve 2.2 (hazır görünüm şeması, yükleyici, `grafit` görünümü): `oguzhan/hazir-gorunum-altyapisi` dalında, PR açık.
- **Kararlar:** adr/0049 Ek 2026-11-14 (bölüm biçimleri, yeni bölüm türleri, üst bilgi ve menü modeli, kategori başına düzen, bölüm başına gelişmiş CSS) ve adr/0063 Ek 2026-11-14 kabul edildi.
- **Deniz'in alanına dokunanlar (bu PR):** backend düzen belgesi ve menü akışları, denetim kaydı kaynağı, `packages/sector-packs` (`general` paket sürümü 1 → 2), üst panel sayım tipi ve sahte sağlayıcı.
- **Sıradaki:** iş 2.3 (`applyPresetWorkflow`), bölüm `variant` altyapısı (adr/0049 eki §9), ardından klasik katalog takımı.
- **Not:** `pnpm verify:changed` bu makinede paralel koşuda zaman aşımı kaynaklı sahte kırmızı veriyor; `--concurrency=1` ile yeşil. Yerelde `ADMIN_MFA=off` varsa `mfa.unit.spec.ts` düşer (turbo ortam değişkenini geçirmiyor); tek başına `ADMIN_MFA= pnpm test:unit` ile geçiyor.
