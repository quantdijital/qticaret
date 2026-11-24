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
| Yalnız vitrin, tema, `packages/ui` (ve üst panel uygulamaları) | Biçim, derleme, etkilenen paketlerin lint/typecheck/birim testi |
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
- Depo ayarı (sahip): dış katkıcılar için "Require approval for all external contributors"; önbellek herkese açık sayılır. `apps/control-plane`'in `test:integration:http` betiği CI'da hiçbir işte koşmuyor (bu PR'dan önce de öyle): teyit edilecek.
- F16 dağıtım hattı (CD) kurulurken `main`'e çıkış aynı `CI` sonucuna bağlanır.
