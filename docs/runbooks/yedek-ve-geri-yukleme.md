# Yedek ve geri yükleme

> F15.5 (H5). Her mağazanın veritabanı ayrı yedeklenir ve ayrı geri yüklenir (instance-per-tenant, ADR-0001). Betikler `infra/backup/`. Şifreleme aracı `age` (kullanıcı kararı 2026-10-31). Sunucuda zamanlama, saklama süresi ve ikinci kopyanın yeri F16.8'de kurulur (ADR-0003).

## Neyi, nasıl

- **Veritabanı:** `pg_dump` özel biçimi, `age` ile şifreli. Döküm diske düz metin olarak hiç yazılmaz; okunurken şifrelenir.
- **Dosyalar:** ürün görselleri ve özel dosyalar (fatura PDF'leri, etiketler) nesne depoda. Canlıda deponun sürümleme ve ikinci konuma kopyalama özelliğiyle korunur (F16.8). Faturalar 10 yıl saklanır (docs/mali-musavir-sorulari.md 7.1). Dosyalar diskteyse `--files <dizin>` aynı yedeğe şifreli olarak eklenir.
- **Manifest:** açık metindir, kişisel veri içermez. Yedeğin ne zaman alındığını, şifreli dosyaların sha256 özetlerini ve her tablonun satır sayısını yazar. Geri yükleme bunlarla doğrulanır.

## Anahtarlar

- Anahtar çifti **çevrimdışı bir makinede** üretilir: `age-keygen -o quant-yedek-<yıl>.key`. Çıktıdaki `age1...` satırı açık anahtardır.
- Yedek alan sunucuda yalnızca **açık anahtarlar** durur (`recipients.txt`, satır başına bir `age1...`). Gizli anahtar sunucuya hiç konmaz. `backup.sh`, dosyada gizli anahtar görürse çalışmayı reddeder.
- En az **iki alıcı** tanımlanır: birincil anahtar ve ikinci bir kişinin ya da kasanın tuttuğu yedek anahtar. Bir yedeği ikisinden biri açabilir; anahtarlardan biri kaybolursa yedekler kaybolmaz.
- Gizli anahtarlar parola yöneticisinde ve kâğıt çıktı olarak iki ayrı yerde saklanır. Kimin tuttuğu veri ihlali rol tablosuyla birlikte yazılır (F16).
- Anahtar yılda bir yenilenir. Eski anahtar, onunla alınmış son yedeğin saklama süresi bitene kadar tutulur.

## Yedek alma

```sh
infra/backup/backup.sh --db <mağaza-veritabanı> --recipients /etc/quant/yedek/recipients.txt --out /var/backups/quant
```

- Postgres bağlantısı libpq değişkenleriyle kurulur (`PGHOST`, `PGUSER`, `PGPASSFILE`). Parola komut satırına yazılmaz.
- Geliştirmede: `PG_EXEC="docker exec -i -e PGUSER=postgres qticaret-dev-postgres-1"`.
- Üst panelden (mağaza sayfası, "Sürüm ve yedek" sekmesi, "Şimdi yedekle") aynı betik çalışır; yerelde çıktı `infra/tenants/backups/<slug>/`, alıcılar `CP_ESCROW_RECIPIENTS`. Makinede `age` kurulu olmalı.
- Yarıda kalan yedek arkasında dosya bırakmaz. Çıkış kodu 0 değilse yedek alınmamıştır.
- **Öneri (F16.8):** günlük tam döküm, ayrıca sağlayıcının WAL/PITR'si. Hedef RPO: PITR ile 5 dakika, yalnızca dökümle 24 saat. Döküm 35 gün, ayın ilk dökümü 12 ay saklanır.

## Geri yükleme

```sh
infra/backup/restore.sh --manifest <yedek>.manifest.json --identity <gizli-anahtar> --target-db <yeni-veritabanı> [--files-to <dizin>] [--strict]
```

Betik sırasıyla şunları yapar:
1. Şifreli dosyaların özetini manifestle karşılaştırır. Fark varsa durur.
2. Anahtarın yedeği açtığını, veritabanı oluşturmadan önce doğrular.
3. Hedef veritabanı yoksa oluşturur. Tablo içeriyorsa reddeder: geri yükleme hiçbir zaman çalışan bir mağazanın üzerine yazmaz.
4. Dökümü çözerek `pg_restore`'a akıtır.
5. Her tablonun satır sayısını manifestle karşılaştırır. Eksik tablo hatadır. Sayı farkı uyarıdır, çünkü yedek alınırken mağazaya yazılmış olabilir; `--strict` ile hata olur.

**Bütünlüğün sınırı:**
- Manifestteki sha256 yalnızca bozulmayı yakalar. Manifest yedeğin yanında açık durduğu için depoya yazabilen biri dökümü de manifesti de değiştirebilir. `age` göndereni doğrulamaz, alıcılar da açık anahtardır.
- Bu yüzden geri yükleme önce yeni ve boş bir veritabanına, süper kullanıcı olmayan bir rolle yapılır; içerik doğrulanmadan mağazaya bağlanmaz.
- Manifestin depo dışındaki bir anahtarla imzalanması F16.8'de değerlendirilir.
- Betik manifestteki hiçbir metni komut olarak çalıştırmaz: dosya adları doğrulanır, sayılar psql'e değişken olarak verilir (2026-10-31 güvenlik incelemesi).

Çalışan bir mağazayı geri döndürmek için:
1. Mağaza bakım moduna alınır (F16).
2. Yedek yeni bir veritabanına yüklenir ve doğrulanır.
3. Mağazanın `DATABASE_URL`'i yeni veritabanına çevrilir.
4. Eski veritabanı inceleme için bir süre tutulur.

Hedef RTO önerisi mağaza başına 4 saattir (F16.8'de kesinleşir).

## Prova

- Ayda bir: rastgele bir mağazanın son yedeği **gerçek çevrimdışı anahtarla** boş bir veritabanına yüklenir.
- Mağazanın açılıp sipariş listesinin göründüğü kontrol edilir; ardından prova veritabanı kaldırılır.
- Kayıt `docs/runbooks/tatbikatlar/` altına yazılır: süre, boyut, tablo eşleşmesi, sorunlar.
- İlk prova (geliştirmede, 2026-10-31): `tatbikatlar/2026-10-31-yedek-geri-yukleme.md`.
