# ADR-0081: Hızlı CI: değişene göre koşan, önbellekli, paralel hat ve tek sonuç

- **Durum:** Kabul edildi (sahip isteği 2026-11-24)
- **Tarih:** 2026-11-24
- **İlgili:** docs/07 (test), docs/08 (devops), adr/0069 (ürün videosu, ffmpeg), CLAUDE.md "Ortak çalışma"
- **Dayanak:** sahip (2026-11-24): "CI/CD bizi geliştirmeye göre çok yavaşlatıyor. İki kişiyiz. Çok hızlı hareket edebilmeliyiz; hız çok hata yapmamıza sebep olmamalı, denge hıza yakın olsun. Çözüm bu seferlik değil, hep işimize yarasın."

## Bağlam (ölçüldü, 2026-11-24)

Yeşil bir koşu (45350802824): duvar saati **58 dk**, 15 iş, toplam **6,7 makine-saati**. Hesap: açık depo, ücretsiz plan; dakika sınırsız, **aynı anda en çok 20 iş**, koşucu 4 çekirdek. Bir koşu 15 yuvayı 30'ar dakika tuttuğu için aynı anda fiilen tek PR koşuyordu; sekiz açık PR'da sıra saatlerce sürdü.

| Kök neden | Ölçüm |
|---|---|
| Her işte `apt-get install ffmpeg` | Bazı koşucularda Ubuntu deposu 63 MB'ı **16 dk**'da indiriyor (iyi günde 20 sn); 14 işte tekrarlanıyor |
| Playwright tarayıcısı ve kitaplıkları her koşuda ağdan | 9 dk |
| Vitrin/panel dalı da backend'in 12 entegrasyon parçasını koşuyor | Backend bu paketlere bağlı değil; boşa 12 yuva |
| Parça başına tek jest işçisi | 4 çekirdeğin biri çalışıyor; 395 dosya, dosya başına Medusa açılışı ort. 25 sn |
| Birim testleri tek işte, paket paket sırayla | 19 dk |
| Turbo önbelleği koşular arasında tutulmuyor | Değişmeyen paket her koşuda yeniden derlenip test ediliyor |
| Kararsız test tüm koşuyu düşürüyor | Bir günde 3 koşu (süre eşiği, video yarışı) |
| Her birleşmeden sonra `dev`'i dallara birleştirip tam CI | Sekiz dalda zincirleme yeniden koşu; `progress/*.md` çakışması her birleşmede |

## Karar

### 1. Değişene göre koş (`scripts/ci-changes.sh`, `changes` işi)

Dal, `dev` ile ortak atasına göre değişen dosyalarına bakılarak sınıflanır:

| Değişen | Koşan |
|---|---|
| Yalnız notlar (`progress/`, `docs/`, `adr/`, `*.md`) | Hiçbir iş; sonuç saniyeler içinde yeşil |
| Yalnız vitrin, tema, `packages/ui` (ve üst panel uygulamaları) | Biçim, derleme, etkilenen paketlerin lint/typecheck/birim testi; üst panel (`apps/control-plane`) ya da bağlı olduğu çalışma alanı değiştiyse üst panel entegrasyonu (Ek 2026-11-25 (3)) |
| Panel ya da `packages/admin-ui` de | Yukarıdaki + panel e2e |
| Backend ya da ortak paket (`types`, `sector-packs`, `server-kit`, `config`, `testing`) | Hepsi (entegrasyon dahil) |
| Çalışma alanı dışı (kilit dosyası, CI, turbo, kök `package.json`) | Hepsi, süzgeçsiz |
| `dev`, `main`, elle tetikleme | Hepsi, süzgeçsiz, birim testleri önbelleksiz (`--force`). Tek istisna: dalın **son yeşil koşusundan beri** yalnız not geldiyse hiçbir iş |

Lint, typecheck ve birim testleri `turbo --filter=...[ortak ata]` ile yalnız değişen paketler ve onlara bağlı paketler için koşar. Derleme her zaman tamdır. Liste **izin listesidir**: tanınmayan her yol "hepsi" sayılır; yeni bir klasör kendiliğinden atlanmaz. Değişen dosyalar `git diff --no-renames` ile okunur: yeniden adlandırma bir silme ve bir ekleme sayılır, backend dosyasını `docs/` ya da vitrin altına taşımak onu gizlemez. `dev`/`main`'de "yalnız not" kararı son push'a göre değil son yeşil koşunun başına göre verilir (Actions API'sinden sorulur): bir not push'u, koşusunu iptal ettiği kod push'unun yerine geçemez.

### 2. Ağdan her seferinde çekileni önbellekten al

- **ffmpeg** ve **Playwright'ın sistem kitaplıkları**: `scripts/ci-debs.sh` paketleri bir kez depodan indirir, `.deb` dosyalarını Actions önbelleğine koyar; sonraki işler `dpkg -i` ile kurar. Anahtar koşucu imajının sürümünü taşır; önbellek uymazsa depoya düşer. Kaynak yine Ubuntu'nun kendi paketidir (docs/08: `ffmpeg-static` ya da resmî olmayan derleme yok). Önbellek, paketler depodan gelir gelmez ve iş deponun hiçbir kodunu koşturmadan **önce** kaydedilir (`actions/cache/restore` + `save` ayrı; ffmpeg adımı checkout'tan hemen sonra): testlerin ya da bir bağımlılığın bıraktığı paket, sonraki işlerin root olarak kurduğu önbelleğe giremez.
- **Playwright tarayıcısı**: `~/.cache/ms-playwright`, Playwright sürümüyle anahtarlı.
- **Turbo**: `.turbo/cache` koşular arasında tutulur; dal `dev`'in sonuçlarından başlar. Bir haftalık girdiler silinir.

### 3. İşleri yan yana kes, çekirdekleri kullan

- Eski "Lint, typecheck, test, build" işi ayrıldı: **static** (biçim, derleme, lint, typecheck) ve **unit** (altı iş yan yana: backend üç parça `--shard`, panel, storefront, packages; `scripts/ci-unit.sh`).
- **Entegrasyon:** parça başına üç jest işçisi (`JEST_WORKERS=3`; her dosyanın kendi veritabanı ve Redis ad alanı var), on iki yerine sekiz parça; test Postgres'inin verisi bellekte (`--tmpfs`). Yerelde varsayılan bir işçi kalır. Üç işçi iş başına verimi 3 değil ~1,5 kat artırdı (işlemci ve veritabanı çekişmesi); asıl kazanç açılışın ucuzlamasında (Sonraki adımlar).

### 4. Kararsız test koşuyu düşürmez, ama görünür kalır

CI'da entegrasyon testi düşerse bir kez daha denenir (`integration-tests/plain-failures.js`). İlk hata günlükte kalır ve işin özetinde "Tried twice" başlığıyla adı yazılır. İkinci denemeye muhtaç test **hata sayılır ve onarılır**; yeniden deneme onu saklamak için değil, koşuyu kurtarmak içindir. Yerelde yeniden deneme yoktur. **Muafiyet:** arada bir düşmenin bulgunun kendisi olduğu dosyalar hiç yeniden denenmez: adı ödeme, iade, stok, hediye kartı, bildirim, yarış, idempotency geçenler ve istekleri yan yana gönderen (`Promise.all`) her dosya. Liste elle tutulmaz; dosyanın adından ve kaynağından okunur.

### 5. Tek sonuç: `CI`

`gate` işi (adı `CI`) koşan her iş yeşilse yeşildir; atlanan iş yeşil sayılır. Birleştirme yalnız buna bakar. `paths-ignore` kalktı: her push bir sonuç alır (not push'unda saniyeler içinde), böylece zorunlu denetim hiçbir zaman gelmeyecek bir koşuyu beklemez.

### 6. Akış kuralları (CLAUDE.md'ye işlendi)

- PR, **kendi başının** `CI` sonucu yeşilse birleşir; dalın `dev`'e göre güncel olması **gerekmez**. `dev` dala yalnız gerçek çakışmada (GitHub "conflict" diyorsa) birleştirilir.
- **Güvenlik ağı `dev`'dedir:** her birleşmeden sonra `dev` tam koşar. `dev` kırmızıysa birleştiren önce onu onarır (ileri düzeltme ya da geri alma); kırmızı `dev`'in üstüne yeni iş birleşmez. `main` yalnız yeşil `dev`'den çıkar.
- Ödeme, auth, migration, güvenlik PR'larında inceleme kuralı aynen sürer (CLAUDE.md).
- `progress/*.md` birleşmede iki tarafın satırlarını tutar (`.gitattributes`, `merge=union`).
- Push seyrek: düzeltmeler biriktirilip tek push yapılır (aynı dalın eski koşusu kendiliğinden iptal olur).

### 7. Sahibin tek seferlik ayarı (isteğe bağlı)

Depo ayarlarında "Allow auto-merge" açılır ve `dev` için `CI` zorunlu denetim yapılırsa (dal güncelliği **zorunlu değil**), PR açılırken `gh pr merge --auto --merge` denir ve yeşil olunca kendiliğinden birleşir; kimse sonucu beklemez. Açılmazsa bugünkü gibi elle birleştirilir; hattın geri kalanı buna bağlı değildir.

## Seçilmeyenler

- **Kendi koşucumuz (self-hosted):** açık depoda dışarıdan gelen kodun makinemizde koşma riski; dakika zaten sınırsız. Gerek kalmadı.
- **Backend PR'ında entegrasyon testlerinin yalnız "ilgili" olanlarını koşmak:** HTTP testleri kaynağa içe aktarmayla değil ağ üzerinden bağlı; ilgi tahmini sezgisel kalır. Tam takım ucuzlatıldı, seçim yapılmadı.
- **Birleştirme sırası (merge queue):** bu planda yok.
- **ThinkPad'de tam takım:** 16 GB ile geliştirmeyi kilitliyor; yerelde yalnız değişen dosyaların testi (mevcut kural).

## Ölçüm (öncesi / sonrası)

Tam koşu (backend'e dokunan dal), aynı gün, aynı hesap:

| | Öncesi (45350802824) | Sonrası (45410820123) |
|---|---|---|
| Duvar saati (sıra dahil) | 58 dk | 32 dk |
| En uzun iş | 43 dk | 17,9 dk |
| Toplam makine süresi | 6,7 saat | 2,5 saat |
| Panel e2e | 35 dk | 12,2 dk |
| Entegrasyon | 12 parça, 18-33 dk | 8 parça, 11,6-17,9 dk |
| Birim testleri | tek işte ~19 dk | backend 3 parça 5,2-6 dk; panel, storefront, packages ~1 dk (turbo önbelleği) |
| Biçim, derleme, lint, typecheck | aynı işin içinde | 6,9 dk |
| ffmpeg kurulumu | 16 dk'ya kadar | önbellekten < 30 sn |

Yalnız vitrin/panel dalı entegrasyonu atlar (en uzun işi static, ~7 dk); yalnız not push'u saniyeler sürer. Bir koşu yuvaları 2,5 makine-saati tuttuğu için aynı 20 yuvadan ~2,5 kat koşu geçer.

## Sonraki adımlar

- **Medusa açılışını ucuzlat (dal `oguzhan/test-acilis-hizi`, ayrı PR):** 395 dosyanın her biri veritabanını baştan göç ettiriyor. Göç edilmiş şablon veritabanı bir kez kurulup her dosyada kopyalanır (`integration-tests/template/`); yerelde dosya başına 21-25 sn kazanç ölçüldü. CI ölçümü o PR'da.
- Kararsız testler: `hostile.unit.spec.ts` süre bütçesi bu PR'da onarıldı; `product-video-transcode.spec.ts` (kaynak silme yarışı) ve `ai-craft.spec.ts` "owner's craft ... at the same time" (yük altında kayıp güncelleme; gerçek yarış olabilir) incelenecek.
- Depo ayarı (sahip): dış katkıcılar için "Require approval for all external contributors"; önbellek herkese açık sayılır. ~~`apps/control-plane`'in `test:integration:http` betiği CI'da hiçbir işte koşmuyor (bu PR'dan önce de öyle): teyit edilecek.~~ Kapandı: koşmuyordu, artık koşuyor (Ek 2026-11-25 (3)).
- F16 dağıtım hattı (CD) kurulurken `main`'e çıkış aynı `CI` sonucuna bağlanır.

## Ek (2026-11-24): birkaç spec dosyası tek Medusa açılışı (demet)

**Neden.** Şablon veritabanından sonra da CI'da bir HTTP dosyası ortalama 35 sn (3 işçi) ve bunun çoğu Medusa'nın açılışı; testler kısa. Koşucu dosya içindeki testleri zaten aynı uygulamada, her testten önce veritabanını anlık görüntüye geri alarak yalıtıyor. Deney (yerel, tek işçi, aynı 6 dosya): ayrı ayrı 246 sn, tek açılışta 104 sn, 45/45 test geçti. Koşucuyu aynı jest dosyasında art arda çağırmak çalışmaz (ilk koşucunun `afterAll`'ı ortak bağlantıyı kapatır): tek koşucu çağrısı şart.

**Karar.** `QT_IT_BUNDLE=<n>` açıkken `jest.config.js` dosyaları ada göre sıralayıp n'erli demetlere böler ve `integration-tests/.bundles/` altına (depoya girmez) üretir; aynı checkout her `--shard` işinde aynı demetleri verir. Demet dosyası her spec'in koşucu çağrısını toplar ve tek gerçek koşucuda her dosyanın `testSuite`'ini kendi `describe("<dosya adı>")`'ı altında koşar. Dosyalar arasında veritabanı Medusa'nın açıldığı hâle döner ve koşucunun anlık görüntüsü dosyanın ilk testinde yeniden alınır (dosya tek başınayken gördüğünü görür); casuslar geri alınır, gerçek zamanlayıcılar döner; dosyanın `jest.setTimeout` değeri kendi test ve kancalarına verilir, açılış ve koşucunun kancaları demetin en büyük değeriyle bekler. Yeniden deneme kuralı tek yerde (`integration-tests/bundle/classify.js`): yeniden denenebilen dosyalar **plain**, denenmeyenler (ödeme, stok, yarış, `Promise.all`) **strict** demetlere girer; demetin sınıfı adındadır. Koşucuya `testSuite` dışında seçenek veren, `jest.mock` kullanan, modül düzeyinde `process.env` yazan, sahte zamanlayıcı açan, casus kuran, kanca/test tanımlayan, başka dosyayla aynı step/workflow kimliğini tanımlayan dosyalar ve `solo.txt`'dekiler tek başına koşar. Yalnız `@medusajs/test-utils`'in açık seçenekleri (`dbUtils`) ve jest'in kendi olanakları; çekirdeğe ve spec dosyalarına dokunulmadı. CI'da HTTP işlerinde `QT_IT_BUNDLE=8`; parça sayısı ölçümden sonra. Ayrıntı: `apps/backend/integration-tests/bundle/README.md`.

**Riskler.** Dosyalar artık bir süreci paylaşıyor: bellek içi önbellekler (30-60 sn), oran sınırı sayaçları (CI'da Redis yok, süreç belleğinde; IP başına sınırlar testte 100 kat gevşek, kimlik başına sınırlar rastgele kimliklerle sayılıyor), modül düzeyi değişkenler, son testten sonra süren arka plan işi. Bunlar dosya içindeki testler arasında da vardı; demetle dosyalar arasına da taşınır. Demette düşüp tek başına geçen dosya ya onarılır ya gerekçesiyle `solo.txt`'ye yazılır. Bir demetin açılışı düşerse içindeki bütün dosyalar düşer; hata demetin dosyalarını sayar. İşçi belleği (`workerIdleMemoryLimit` 1 GB) ancak dosyalar arasında yenilenir; bir demet tek dosya sayılır. Kapatmak: CI'da `QT_IT_BUNDLE` satırı silinir.

**İlk tam CI koşusu (45446883339).** 50 demetin 13'ü, ~1700 testin 91'i düştü. Kök neden tek: süreçte tutulan ve veritabanıyla birlikte geri dönmeyen değerler. (1) `*_BASE_URL`'den bir kez kurulan sağlayıcı istemcileri (PayTR, iyzico, Geliver, Aras, Yurtiçi) ilk dosyanın sahte sunucusuna bağlı kalıyor, sonrakiler kapanmış adrese gidip 503 ya da `circuit_open` alıyordu; (2) sürümlü önbellek (Redis yokken 30 sn) önceki dosyanın sağlayıcı hesabını ve SMTP ayarını, TTL önbellekleri (60 sn) önceki dosyanın vitrin düzenini ve çok satanlarını veriyordu. Onarım: `src/lib/cache/process-caches.ts`; bu değerlerin her biri yalnız NODE_ENV=test altında nasıl unutulacağını kaydeder, demet her dosyadan önce veritabanıyla birlikte hepsini unutur. Hiçbir dosya `solo.txt`'ye alınmadı. Demetle ilgisiz iki düşüş kaldı: `uploads.spec.ts` paylaşılan `static` klasörünü sayıyor (paralel işçiler de yazıyor), `ai-craft.spec.ts` "at the same time" zaten kararsız listesinde. Süre: demet açılışı ve kurulumu demet başına ~19 sn (işçi süresinin %9'u), dosya başına veritabanı geri dönüşü ~0,2 sn; işçi süresinin %86'sı testlerin kendisi (en uzun dosya `catalog-sheets` 412 sn). Kalan kazanç açılışta değil parça dengesinde: en uzun parça 812 sn, en kısası 352 sn.

**Süreye göre demet ve parça (2026-11-24).** İkinci tam koşuda (45460501446) 8 HTTP parçası 319–684 sn sürdü: jest `--shard` dosyaları yol özetine göre böldüğünden ağır demetler aynı parçaya düşüyordu. Her dosyanın CI süresi `integration-tests/bundle/weights.json`'a yazıldı (401 dosya, 8642 sn test; demet başına açılış 17 sn, ortanca); `weights.js` aynı dosyayı CI günlüklerinden yeniden üretir, bilinmeyen dosya ortanca ağırlığı alır. Demetler artık en çok 8 dosya ve ~180 sn testle dolar (ağır dosya kendi demetinde), her demet beklenen süresini taşır; demet kipi açıkken özel `testSequencer` parçaları ağırlığa göre dağıtır (en ağır önce, en boş parçaya; her işte aynı sonuç) ve işçiler en ağır dosyadan başlar. Kip kapalıyken jest'in kendi sıralayıcısı. Aynı ağırlıklarla beklenen en uzun parça (3 işçi, kurulum hariç): eski düzen 8 parça 656 sn (ölçülen 684), yeni düzen 8 parça ~434, 7 parça ~489, 6 parça ~565 sn. Aynı PR: `forgetProcessCaches` test dışında hiçbir şey yapmaz ve test dışı koddan içe aktarılamaz (ortak ESLint); `product-video-transcode` "ready" ile kaynağın silinmesi arasındaki pencereyi bekler; `uploads.spec.ts` paylaşılan `static/` klasörünü saymak yerine kendi dosya adlarına bakar; birim test matrisi yalnız dalın eriştiği grupları açar (`scripts/ci-unit-groups.mjs`). `catalog-sheets` (~280 sn) sürenin neredeyse tamamını 1000 satırlık içe aktarma kabul testinde harcıyor (denetim ~50 sn, uygulama ~3 dk; 198 ürün, 990 varyant); testte gereksiz bekleme yok, hızlandırma üretim kodunun işi.

**İlk ağırlıklı koşu (45472093725).** Denge tutmadı: parçalar 7,2–12,3 dk (eski düzen 7,0–10,8), toplam 67 → 76 makine-dk; parça sayısı 8'de kaldı. Ağırlıklar dosyanın kancalarını ve geri yüklemeyi zaten içeriyor (`[bundle] <dosya> <sn> s` satırı geri yüklemeden son `afterAll`'a kadar ölçer): altı parçanın günlüğünde 288 dosyada ölçülen/ağırlık ortancası 1,04. Sapma yanındakine bağlı (p10 0,60, p90 1,82; `catalog-sheets` 279 → 422 sn, `messages` 79 → 155): dört çekirdekte üç işçi, tek koşunun ölçümü gürültülü. `weights.js` artık bütün koşunun günlüğünü (`gh run view --log`) okur, birden çok koşunun günlüğü her dosyaya ortancasını verir; ağırlıklar sonraki koşulardan yeniden üretilecek, denge henüz kanıtlanmadı. Yeni komşuluk iki sızıntı gösterdi, ikisi de yerinde onarıldı: (1) `seo-sitemap-refresh` açılışın hemen ardından ilk tıkında haritayı sıraya koydu ve demetin açılış görüntüsü işi `running` hâlinde yakaladı; arkasında süreç olmayan bu kayıt sonraki dosyaların aynı türden işini 409 `async_job.already_running` ile reddetti (`listing-sale`). Demet her dosyadan önce `queued`/`running` işleri siler. (2) Redis yokken sağlayıcı hata günlüğü süreç belleğinde; `integration-credentials`'ın ürettiği PayTR ağ hatalarını `integrations-overview` görüyordu. Günlük `registerProcessCache` ile kaydoldu (üretimde etkisiz).

**Üç koşunun ortancası; panel e2e iki iş (2026-11-24).** (1) `weights.json` üç koşunun (45460501446, 45472093725, 45480028281) dosya başına ortancası; `weights.js` düşen demetin dosyalarını ve düşen tek dosyayı ölçüme katmaz (ikinci koşuda 14 ölçüm; `listing-sale` düşen demette 58 sn, diğer koşularda 15-20). Son koşunun (45480028281) demetleriyle geriye dönük sınama, yalnız önceki iki koşudan üretilen ağırlıkla (son koşu dışarıda): demet başına ölçülen/tahmin p10-p90 0,64-1,55 → 0,72-1,47, parça toplamında 0,81-1,40 → 0,87-1,35; küçük iyileşme. Sapmanın çoğu ağırlık değil iş: aynı dosyalar son koşunun 6/8 işinde önceki koşudakinin 1,21 katı (ilk koşuya göre 1,64), 8/8'de 1,31 katı sürdü; ikinci koşuda yavaş olan işler başka (1, 4, 5). Koşucu hızı dosya ağırlığıyla düzelmez. İş içi üç işçiye paketleme kaybı küçük: jest süresi − toplam/3 = 6-31 sn; `shards.js` değişmedi. (2) Panel e2e tam koşunun en uzun halkasıydı (13,7-14,5 dk: ~2 dk kurulum, 11,6 dk 132 test, 2 işçi). Playwright `--shard=1/2`, `2/2` ile iki işe bölündü: `fullyParallel` kapalıyken bölme dosya düzeyinde, test sayısına göre; 1/2 yalnız `a11y.e2e.ts` (106 test, tek işçide 6,8 dk), 2/2 diğer 10 dosya (24 test); `setup`/`teardown` (geçici yönetici) ikisinde de koşar. Tam koşu 19 → 20 iş; `changes` önce, `CI` sonra koştuğundan aynı anda en çok 18 iş (kuruluşun eşzamanlı sınırı 20; aynı anda başka koşu varsa sıra uzar).

**Üç takip (2026-11-25).** (1) Demette dosyadan dosyaya sızan, kaydı olmayan süreç içi tutucular kaydedildi (Google, Netgsm, Netgsm İYS, dönüşüm istemcileri; platform ve mağaza e-posta taşıyıcısı; gönderen DNS önbelleği; Redis yokken rezervasyon mutabakat sayaçları ve yapay zekâ sohbet deposu; bakım korumasının son bilinen ayarı; Turnstile istemcisi ve anahtarları; kontrol düzleminin ödeme geçmişi ve işlerinin son koşusu). Kalıcı koruma `src/lib/cache/__tests__/process-state-census.unit.spec.ts`: modül düzeyinde `let` ya da boş `new Map()`/`new Set()` tutan her dosya ya kayıtlıdır ya da gerekçesiyle izin listesindedir (ortamdan bir kez okunan, uçuştaki iş, bir kez söylenen günlük); listede artık uymayan dosya da düşer. (2) Backend birim testleri CI'da parça başına üç jest işçisiyle koşar (`TEST_UNIT_WORKERS`, `scripts/ci-unit.sh`; yerelde `--runInBand` aynen). `--runInBand` Medusa başlangıç şablonundan geldi; Redis'e giden iki birim testi rastgele önekli anahtar kullanıyor, sunucular 0 numaralı portu, dosyalar `mkdtemp` klasörlerini: işçiler arasında ortak yazılan bir şey bulunmadı. Parça sayısı üçte kaldı; süre ölçülünce azaltılacak. Aynı PR'da büyük düşman girdiyi duvar saatiyle ölçen birim testleri (`hostile`, WordPress okuma, SEO `plainText`, XML istemcisi, AI kaynak, AI sertleştirme) büyüme oranına geçti (`measureGrowth`: 8 kat girdi, 8^1,5 kattan az süre). (3) Panel e2e CI'da `github` yanında `list` raporlayıcısıyla koşar: her testin süresi günlükte, iki parça dosya süresine göre dengelenecek.

**Ek 2026-11-25 (2): ilk koşunun ölçümüyle iki ayar (aynı PR, koşu 45491934646).** (1) Backend birim testleri üç işçiyle parça başına 5,2–6,5 dakikadan 2,9–3,2 dakikaya indi (bunun ~1,5 dakikası kurulum); üç parça tek işe indirildi (`scripts/ci-unit-groups.mjs` `GROUPS`; yeniden kesmek için oraya `"backend 1/2"`, `"backend 2/2"` yazmak yeter). Tam koşu 20 işten 18 işe iner. (2) Panel e2e'nin iki işi artık test sayısına göre değil ölçülen süreye göre ayrılıyor (`E2E_GROUP`, `apps/panel/e2e/playwright.config.ts`): 1. grup adı yazılı dosyalar (`a11y`, `scroll`, `dialogs`; ~616 işçi-saniye), 2. grup geri kalan her dosya (~562 işçi-saniye; yeni dosya listelenmeden buraya düşer). Sayıya göre bölmede işler 4,9–6,5 ve 11,4–13,6 dakika sürüyordu; ağır olan az sayıdaki "her sayfayı gez" testleriydi (`shell` 276 sn, `scroll` 145 sn, `layout` 90 sn, `phone` 84 sn). Dosya sürelerini yeniden ölçmek için e2e iş günlüğündeki `list` satırları yeter.

**Ek 2026-11-25 (3): üst panel entegrasyon testleri.** **Neden.** `apps/control-plane`'in 28 HTTP dosyası (~205 test) hiçbir CI işinde koşmuyordu (Sonraki adımlar'daki "teyit edilecek" maddesi); üst panele para tutan kod (yapay zekâ kredi cüzdanı) geliyor. **Ne eklendi.** `integration` matrisi artık sabit değil: `changes` işi koşulacak takımları `integration` çıktısında JSON listesi olarak verir (eski `backend` çıktısının yerine; `scripts/ci-changes.sh`). Backend'in dokuz işi aynen; üst panelin tek işi yeni: **`Integration tests (control plane)`**, tek jest işçisi, `--silent=false` (jest'in yeniden deneme günlüğü "Tried twice" özeti için gerekli; Medusa'nın günlük satırlarını `--silent` zaten kesmiyor). Servis, sır üretimi, kurulum ve özet adımı ortak olduğundan ayrı iş değil matris girdisi. Matrisin her işinde artık bir Redis servisi var: üst panel personel oturumlarını Redis'te tutar (`cp:end-sessions` testi onlara orada son verir); backend'e `REDIS_URL` verilmez, onun için değişen bir şey yok. Servisi yalnız üst panel işinde açmak görüntüyü bir ifadenin içine sokar ve Renovate onu güncelleyemez; maliyeti birkaç saniye. Kapı (`CI`) değişmedi: `integration` zaten `needs`'te. **Ne zaman koşar.** Değişen dosyalar `@qticaret/control-plane`'e ulaşıyorsa: kendisi ya da `package.json`'ındaki çalışma alanları ve onların bağımlılıkları (`sector-packs`, `server-kit`, `types`, `config`); hesap çalışma alanlarının manifestlerinden, birim test gruplarıyla aynı yerde (`scripts/ci-unit-groups.mjs --reaches`). Kilit dosyası, CI ve çalışma alanı dışı her dosya, `dev`, `main`, elle tetikleme: her zaman. Yalnız backend, vitrin/tema, panel, `control-plane-panel` ya da `packages/testing` (üst panel ona bağlı değil) değişen dal: koşmaz. **Zamanlanmış işler testlerde kapalı** (`integration-tests/setup.js`): Medusa altı işi (fatura her saat `:07`, plan gönderimi her dakika, sağlık yoklaması beş dakikada bir…) testlerde de saatine göre çalıştırıyordu; bir tık dosyanın ortasında testin kendi mağazalarını faturalayabilir, onlara plan gönderebilir, yoklayabilirdi. Medusa'nın kendi anahtarıyla (`defineFileConfig({ path, isDisabled })`, iş yükleyicisinin okuduğu yol) kapatıldı; `LOG_LEVEL=debug` ile önce 6 "Registering job", sonra 0. Bir işin yaptığını sınayan test onun fonksiyonunu çağırır (bugünküler zaten öyle). **Yeniden deneme** backend'deki gibi (`integration-tests/retry.js`): CI'da düşen test bir kez daha denenir ve özette adı yazılır; adında `billing`, `wallet`, `credit`, `payment`, `invoice`, `ledger`, `refund`, `race`, `idempot` geçen ve `Promise.all` kullanan dosyalar hiç denenmez (bugün `billing-*` dördü, `tenant-status`, `tenant-availability`; kredi cüzdanının `ai-credits-*` dosyaları adlarından ötürü). **Onarılanlar.** (1) `sector-packs.spec.ts`: bıçak paketinin sürümünü 1 ve hazır görünüm sayısını 0 diye yazıyordu; paket 16. sürümde ve dört hazır görünüm taşıyor. Sürüm, sayılar ve ilk uygulamada eklenen öge sayısı artık paketten okunuyor (`sectorPack`, `summaryOf`). (2) `staff-sessions.spec.ts` "cp:end-sessions" CI'da Redis olmadığı için düşüyordu (test değil ortam eksikti; Redis servisi). **Süre.** İlk CI koşusu (45530759088, o zaman iki parça): 28 dosya 140 + 162 sn test, dosya başına 5–20 sn (en uzun `staff-proofs` 19,7, `provisioning` 17,1, `staff-roles` 16,4, `staff-sessions` 14,7, `tenants-tckn` 14,2 sn); toplam ~5 dk, 10 dakikanın altında olduğu için tek iş (kurulumla ~6,5 dk; backend'in parçalarından kısa, koşunun süresini uzatmaz). Yerelde (ThinkPad WSL, tek işçi, makinede başka sunucular açıkken) 28 dosya ~17 dk (dosya başına 15–128 sn ve yüke göre oynak: aynı `error-logging` iki ölçümde 41 ve 78 sn; en uzun `provisioning` 128, `keys` 83, `error-logging` 78, `sector-packs` 75, `dashboard` 47 sn), hepsi geçti (`staff-sessions` Redis ile). **İş sayısı.** Tam koşu 18 → 19 iş, aynı anda en çok 17 (hesap sınırı 20). Yalnız üst panele dokunan dal: `changes`, `static`, birim `packages`, üst panel entegrasyonu, `CI`. **Yerel not.** WSL'de kapalı bir `127.0.0.1` portuna bağlantı reddedilmek yerine zaman aşımına düşüyor; `isPortFree` port başına 1 sn bekleyip 9200–9299'da boş port bulamıyor ve mağaza kuran dosyalar (`provisioning`, `sector-packs`) yerelde `provisioning.no_port` ya da "run did not finish" ile düşüyor. Linux koşucusunda bağlantı anında reddedilir; CI'da olmaz.
