# Devir: G1 liste sayfası açıklamaları (PR #250)

**Hedef:** ADR-0074 §5 madde 1 (G1): kategori/koleksiyon/marka açıklama işleri, `collection`/`brand` varlıkları, bu sayfalarda SEO işleri, advisor eşlemesi, panel ✨. PR #250 (base dev). BİRLEŞTİRİLMEYECEK.

**Dal / worktree:** `oguzhan/ai-liste-aciklamalari`, `/home/oguzhan/projeler/qticaret-wt2`.

## Commit'ler
- c96598dc feat(ai): listing description tasks, collection/brand facts, advisor CONT-01 per kind
- 30e71ef9 feat(panel): ✨ on listing description cards, collection/brand SEO cards, guidance list, i18n; ADR-0074 Ek (3)
- c9114c08 fix(ai): güvenlik bulguları D1 (category-tree.ts `shownCategoryIds`), D2 (`MAX_BRAND_PRODUCT_IDS`), B1 (kapalı koleksiyon adı)
- 36d562a6 test(ai): HTTP testi metni kapının verdiği biçimde bekler (boş satırlar kapanır)
- ab03c63f test(seo): `seo-advisor.spec.ts` marka bulgusu artık AI eşlemesi taşır

## Durum
- Güvenlik incelemesi bulguları D1, D2, B1 kapandı; PR gövdesine yazıldı.
- CI: son push (ab03c63f) için sonuç bekleniyor. Önceki koşuda kırılan yalnız `ai-listing.spec.ts` (36d562a6 ile düzeltildi) ve `seo-advisor.spec.ts` (ab03c63f ile düzeltildi) idi; lint hatası (gereksiz tip iddiası) c9114c08'de düzeldi.

## Kalan adımlar
1. `gh pr checks 250 --watch --interval 60` ile bekle; kırmızıysa `gh api repos/quantdijital/qticaret/actions/jobs/<id>/logs` → `FAIL integration` ve `●` satırlarına bak, düzelt, push.
2. Yeşil olunca PR gövdesindeki "CI: (aşağıda güncellenecek)" satırını güncelle (`gh api -X PATCH repos/quantdijital/qticaret/pulls/250 -F body=@dosya`; `gh pr edit` Projects classic hatası veriyor).
3. Rapor: PR #250, CI, kararlar, şüpheler.

## Yerel testler (geçti)
- Backend: `TEST_TYPE=unit npx jest --maxWorkers=2 src/lib/ai/__tests__ src/api/admin/ai/__tests__/validators` (395+ test).
- Panel: `npx vitest run --maxWorkers=2` listing-description-card(-ai), seo-card, issue-ai-fix, ai-guidance-tab, kategori/koleksiyon/marka sayfa spec'leri.

## İlgili dosyalar
- backend: `apps/backend/src/lib/ai/{registry/listing-tasks.ts,crafts/listing.ts,facts/listing.ts,facts/listing-products.ts,facts/category-tree.ts,facts/product.ts,registry/advisor-fixes.ts}`, `integration-tests/http/ai-listing.spec.ts`
- panel: `apps/panel/src/features/content/components/listing-description-card.tsx`, `features/seo/components/seo-text-fields.tsx`, `features/seo/advisor/ai-fill.ts`, `features/ai/api/guidance.ts`, locales.
