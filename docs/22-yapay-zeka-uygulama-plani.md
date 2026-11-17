# Yapay zekâ çekirdeği: uygulama planı

> Karar: `adr/0071-yapay-zeka-cekirdegi.md`. Bu belge o kararın PR'lara bölünmüş planıdır: dokunulacak dosyalar, testler, kabul ölçütleri ve güvenlik incelemesi gereken PR'lar. Bir PR birleşince durumu `progress/<kişi>.md`'ye yazılır; plan değişirse bu belge aynı PR'da güncellenir.
> Yollar `apps/backend/src/` (backend) ve `apps/panel/src/` (panel) köküne göredir.

## Her PR için geçerli kurallar

- Gerçek servise çıkan test yok: çekirdek testleri `fake` servisle, bağlayıcı testleri `fetch` taklidi ve kayıtlı yanıtla koşar.
- Bir servisin yeteneği kayda **resmi belgeden doğrulanarak** girer; kayıt dosyasına doğrulama tarihi ve kaynak adresi yorum olarak yazılır. Doğrulanamayan yetenek eklenmez, PR'da "doğrulanamadı" diye yazılır.
- Anahtar hiçbir adımın girdisine, çıktısına, hata iletisine, günlüğe ya da test verisine girmez (test anahtarları açıkça sahte: `test-key-…`).
- İstem ve hata metinleri sektör nötr; sektöre özgü bilgi yalnız ürünün nitelik şablonundan gelir.
- Arayüz metni `locales/tr.json` + `en.json`; sunucu hata anahtarı `lib/errors/messages/{tr,en}.ts`.
- Dosya ~300 satır; route ince (doğrula → akış → dön).
- **Güvenlik incelemesi** işaretli PR: `security-reviewer` koşulur, bulgular ve kapanışları PR'a yazılır, ana oturum birleştirir.

## Aşama 0b: backend çekirdek

### PR 0b-1: kayıtlar, seçim, bağlayıcı, kapı (saf kütüphane)

- **Dosyalar (yeni):** `lib/ai/registry/capabilities.ts`, `tasks.ts`, `services.ts`; `lib/ai/select.ts`; `lib/ai/connectors/types.ts`, `openai-compatible.ts`, `fake.ts`; `lib/ai/prompt.ts` (sistem iletisi + veri bloğu); `lib/ai/gate.ts` (bugünkü `draftProblems`'ı çağırır, taşımaz); `lib/ai/errors.ts` (servis yanıtı → `ai.*` anahtarı); `lib/ai/cost.ts`; `lib/ai/limits.ts`; `lib/errors/messages/{tr,en}.ts` (`ai.*`).
- **Dokunulmaz:** `lib/content-drafts/**`, `workflows/content/drafts.ts`.
- **Testler (birim):** seçim tablosu (boş, tek, çok, istenen servis listede yok, tercih, bayrak kapalı); bağlayıcı: istek biçimi, anahtar yalnız başlıkta, zaman aşımı, 401/429/5xx eşlemesi, tek yeniden deneme yalnız 429/5xx'te, hata nesnesinde gövde ve başlık yok; istem: veri bloğu ayrı ileti, ayıklama uygulanmış, enjeksiyon dizgisi veri olarak kalıyor; maliyet tahmini; kayıt bütünlüğü (her işin yeteneği var, her servisin adresi `https` ve sabit).
- **Kabul:** `fake` dışında hiçbir servis doğrulanmamış yetenekle kayıtlı değil; `pnpm --filter backend test:unit` yeşil.
- **Güvenlik incelemesi:** evet (dış çağrı, anahtar taşıma).

### PR 0b-2: servis hesapları ve bayrak

- **Dosyalar:** `modules/integration-credentials/providers.ts` (yapay zekâ kayıtları `providers-ai.ts`'e bölünür; `deepseek`, `minimax`, `gemini`), `lib/integrations/account-check.ts` (+ `lib/ai/account-check.ts`: servis başına üretimsiz doğrulama çağrısı), `packages/types/src/control-plane/platform-flags.ts` + `modules/platform-settings/features.ts` (`ai.own_keys`, aynı değişiklikte), bayrak i18n anahtarları, `workflows/integration-credentials/**` (bayrak kapalıyken yapay zekâ servisi bağlama reddi: `ai.own_keys_not_in_plan`).
- **Testler:** `integration-credentials.spec.ts` deseninde http: bağla, dene, anahtar yanıtta yok, `admin` bağlayamaz, bayrak kapalıyken 403 ve satır korunur; platform bayrağı eşitlik testi (var olan) yeşil; `permissions.unit.spec.ts`.
- **Kabul:** yeni servis satırı zarf şifrelemeyle yazılır; migration yok.
- **Güvenlik incelemesi:** evet (kimlik bilgisi, yetki). Deniz'e not: `platform-flags.ts` ortak dosya.

### PR 0b-3: modül, akış adımları, uçlar

- **Dosyalar (yeni):** `modules/ai/{index.ts,service.ts,models/ai-usage.ts,models/ai-preference.ts,migrations/*}`; `medusa-config.ts` (modül kaydı); `workflows/ai/steps/{select-service,claim-quota,call-service,record-usage}.ts`; `workflows/ai/suggest-text.ts`; `api/admin/ai/{services,suggestions,usage}/**` + `validators.ts`; `api/http/ai-routes.ts`; `lib/security/rate-limit/profiles.ts` (`ai_text`, `ai_media`); `lib/staff/permission-rules.ts`; `lib/plan-guard/rules.ts`; `lib/env.ts` + `.env.example` (günlük tavanlar); `docs/kvkk-envanter.md` §4 satırı; `api/admin/openapi.json` (üretiliyorsa yeniden).
- **Testler:** modül (`service.spec.ts`: tercih yazma okuma, kullanım toplamı); http `ai.spec.ts`: servis yokken `ai.no_service`; tek servis; iki servis ve tercih; kota dolu; günlük tavan; rol tablosu; çağrı düşünce kota geri verilir ve `ai_usage` `failed` yazar; yanıtlarda ve `workflow_execution` verisinde anahtar yok; hız sınırı.
- **Kabul:** `GET /admin/ai/services` sahte servisle doğru yetenekleri döner; `POST /admin/ai/suggestions` Aşama 1 işleri olmadan da `fake` işle uçtan uca çalışır; migration adı benzersiz.
- **Güvenlik incelemesi:** evet (migration, yetki, dış çağrı).

## Aşama 0c: panel

### PR 0c-1: Ayarlar › Yapay zekâ

- **Dosyalar:** `features/settings/sections.ts`, `features/settings/pages/ai-page.tsx`, `features/settings/components/ai-service-card.tsx`, `ai-usage-card.tsx`, `features/ai/api/ai.ts` (sorgular), rota dosyası, `locales/{tr,en}.json` (`ai.*`), `features/settings/integrations.ts` (Entegrasyonlar sayfasında bağlantı).
- **Testler:** kart durumları (bağlı değil, bağlı, reddedildi, okunamıyor, paket kapalı), anahtar alanı geri doldurulmaz, `owner` olmayan bağlama düğmesi görmez, veri notu görünür.
- **Kabul:** Chromium + WebKit, 1440/768/390'da görsel denetim; var olan `credential-dialogs.tsx` yeniden kullanılır.

### PR 0c-2: ortak bileşenler

- **Dosyalar (yeni):** `features/ai/components/{ai-button,ai-service-picker,ai-suggestion-box,ai-connect-hint}.tsx` + testleri; `features/ai/use-ai-suggestion.ts` (istek, yeniden dene, başka servisle dene durum makinesi).
- **Testler:** tek serviste seçici yok; çok serviste var ve seçim istekle gider; hata → "Başka servisle dene" yalnız `alternatives` doluyken; "Kullan" yalnız `onUse` çağırır, kayıt isteği atmaz; ipucu kapatılınca hatırlanır; klavye ve ekran okuyucu adları.
- **Kabul:** bileşenler hiçbir sayfaya bağlanmadan (hikâye ya da test sayfası) çalışır; docs/18'e bileşen notu.

## Aşama 1: SEO başlık ve meta önerisi

### PR 1-1: backend işleri

- **Dosyalar:** `lib/ai/registry/tasks.ts` (`seo_title`, `seo_description`), `lib/ai/facts/{product,category,page}.ts` (bugünkü `productFacts` süzgeçleriyle: yalnız herkese açık nitelikler), `workflows/ai/suggest-text.ts`, kapı: `lib/seo/advisor` alan kuralları.
- **Testler:** üç varlık türü için gerçekler (özel nitelik gitmez, kişisel veri ayıklanır); kapıdan geçmeyen öneri `refused`; `accept` alanı yazmaz; fiyat hiçbir istemde yok.
- **Kabul:** sahte servisle üç varlıkta öneri; gerçek servisle elle duman testi (kayıt PR'a yazılır, CI'da koşmaz).

### PR 1-2: panel bağlama

- **Dosyalar:** `features/seo/components/seo-card.tsx` (başlık ve açıklama alanlarının yanına `AiButton`), kategori ve sayfa formlarındaki aynı kart.
- **Testler:** `seo-card.spec.tsx`: öneri forma düşer, kaydetmeden çıkınca kaybolur, piksel genişliği göstergesi öneriyle güncellenir.
- **Kabul:** tarayıcı denetimi; servis yokken ipucu.

## Kredi satışı (Aşama 1'den sonra)

ADR eki + F16 ile birlikte. Kapsam: `ai.platform_credits` bayrağı, `ai_free_credits_per_month` limit anahtarı, `ai_credit_entry` migration'ı, `platform` servisi, ayır/kesinleştir/geri ver adımları, günlük kredi tavanı, `GET /admin/ai/credits`, panelde bakiye. Önkoşullar: Aşama 1'den en az birkaç haftalık `ai_usage` verisi; docs/12'deki yeniden satış izni; açık karar 2 (anahtarların yeri). **Güvenlik incelemesi:** evet (para, migration).

## Aşama 2: ürün açıklaması taslağı

- **PR 2-1 (backend):** `product_description` işi; `lib/content-drafts/{redact,gate,prompts}` → `lib/ai/`; `workflows/content/drafts.ts` karar akışı kalkar (kabul artık formu doldurur) ya da `accept` içine iner; `/admin/content-drafts*`, `content_draft` hız profili, `CONTENT_DRAFT_PROVIDER`, `content.ai_drafts` kaldırılır (`features/listed.ts` dahil). `content-drafts.spec.ts` yeni uçlara taşınır.
- **PR 2-2 (panel):** `content-drafts-card.tsx` yerine açıklama düzenleyicisinde `AiButton`; hazır seçenek: kısa / ayrıntılı.
- **Kabul:** adr/0005 kabul ölçütleri (onaysız yayımlanmaz, kişisel veri gitmez) yeni testlerde aynen duruyor. **Güvenlik incelemesi:** evet (kaldırılan bayrak ve uçlar).

## Aşama 3: advisor bulgusunda "Yapay zekâyla düzelt"

- `lib/seo/advisor` kurallarında `fix.kind: "suggest"` olan bulgulara iş adı eşlemesi (`lib/ai/registry/advisor-fixes.ts`); panel `features/seo/advisor` bulgu satırına `AiButton`. Kural motorunun kendisi değişmez. Test: eşlenen her kural için iş var; öneri uygulandıktan sonra bulgu kapanıyor.

## Aşama 4: arka plan temizleme + beyaz zemin

- **PR 4-1 (güvenlik incelemesi, migration):** `media_asset.ai_source`, `derived_from_id`; `lib/ai/connectors/{gemini-image,photoroom}.ts`; `photoroom` kimlik bilgisi kaydı; sonuç indirme (`safeFetch`, izinli alan adı, boyut tavanı) ve yükleme hattı doğrulaması; IPTC yazımı (`lib/media`), türevlerde korunması; `async-job` türü `ai-image-edit` (toplu). Deniz'e not: `modules/media` adr/0069 dilimleriyle aynı modül, migration sırası konuşulur.
- **PR 4-2 (panel):** ortam kütüphanesi ve ürün görsel kartında düğme; önce/sonra karşılaştırmalı öneri kutusu; "Kullan" yeni görseli ürüne ekler, asıl kalır.
- **Kabul:** asıl dosya baytı değişmez; sonuçta `DigitalSourceType` okunur; servis listede olmayan adres döndürürse reddedilir; depolama kotasına sayılır.

## Aşama 5: görsel alt metni

- `image_alt_text` (`vision`), tekli (`sync`) ve toplu (`async-job` `ai-alt-text`; yalnız alt metni boş olanlar, istekte en çok N). Kapı: uzunluk, "resmi", "görseli" gibi dolgu, kişisel veri. Toplu sonuç önerilerdir, liste ekranında tek tek ya da topluca onaylanır.

## Aşama 6: fotoğraftan ürün kartı

- `product_from_photo` (`vision`, yapılandırılmış çıktı): ad, kısa açıklama, önerilen kategori (var olanlardan), nitelik değerleri (şablondaki tanımlardan). Zod şemasında fiyat, stok, durum yok. Sonuç yeni ürün formunu doldurur; hiçbir şey kaydedilmez. **Güvenlik incelemesi:** evet (görseldeki yazı enjeksiyonu, şema).

## Aşama 7: sahne görseli

- `image_scene` (`image_edit` / `image_generate`): en çok iki hazır sahne seçeneği, sektör paketinden gelir (koda sektör girmez). `ai_source: generated` ya da `edited`, IPTC buna göre.

## Aşama 8: fotoğraftan kısa video

- `video_from_photo` (`video`): uzak iş başlat + sorgula, `async-job` `ai-video`; sonuç adr/0069 yükleme ve dönüştürme hattına girer (50 MB, 30 sn, kota). `catalog.product_videos` kapalıysa iş yok. Deniz'e not: adr/0069 dilimleri.

## Aşama 9: yorum özeti + soru cevap taslağı

- Ayrı kiracı bayrağı, varsayılan kapalı; yazar adı ve iletişim ayıklama; `operations` rolüne yalnız bu işler açılır; yanıt taslağı gönderilmez, forma düşer. **Güvenlik incelemesi:** evet (kişilerin yazdığı metin; KVKK envanteri güncellenir).

## Aşama 10–13

Akıllı arama (`embedding`; adr/0056 ile), görünüm asistanı, toplu komut, 3D ve ajan ticareti: her biri kendi ADR'siyle. Bu çekirdek onlara yalnız servis kaydı, seçim, kota ve kullanım kaydını verir.

## Doğrulanacak servis bilgileri (ilgili PR'ın ilk işi)

| Servis | Ne | Hangi PR |
|---|---|---|
| DeepSeek | OpenAI uyumlu uç, taban adres, model adları, JSON kipi, veri işleme şartları | 0b-1 |
| MiniMax | OpenAI uyumlu metin ucu, bölgesel adresler, görsel okuma var mı | 0b-1 |
| Gemini | OpenAI uyumluluk ucunun kapsamı, anahtarın başlıkla gönderimi, ücretsiz katman veri şartı | 0b-1 |
| Gemini | görsel düzenleme ve üretim uçları, filigran | 4-1, 7 |
| Photoroom | uçlar, alan adları, başlık, deneme kipi, beyaz zemin parametreleri | 4-1 |
| MiniMax | görsel üretim, fotoğraftan video, sonuç indirme alan adları | 7, 8 |
| Gemini | video üretimi: erişim ve ücret katmanı | 8 |
| Tümü | yeniden satış izni (platform kredisi için) | kredi aşaması, docs/12 |
