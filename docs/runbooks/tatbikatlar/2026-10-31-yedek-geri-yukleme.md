# Yedek ve geri yükleme provası: 2026-10-31

- **Ortam:** geliştirme (Docker'da Postgres 16.15). Prova için üretilmiş, sonra atılan `age` anahtarları kullanıldı.
- **Yapan:** Claude (F15 H5). **Betikler:** `infra/backup/backup.sh`, `restore.sh`. **Runbook:** `docs/runbooks/yedek-ve-geri-yukleme.md`.

## Akış

1. `age-keygen` ile prova anahtarı üretildi. `recipients.txt` dosyasına yalnızca açık anahtar yazıldı.
2. `backup.sh --db qticaret --files <örnek dizin>`: 1 saniyede tamamlandı.
   - Döküm şifreli olarak 2,6 MB; örnek dosyalar 20 KB.
   - Manifest: 256 tablo, 35.621 satır.
   - Dökümün başı `age-encryption.org/v1` (X25519): düz metin yok.
3. `restore.sh --target-db qticaret_prova --files-to <yeni dizin> --strict`: 2 saniyede tamamlandı.
   - **256 tablonun hepsi eşleşti; fark ya da eksik yok.**
   - Dosyalar birebir aynı (`diff -r`).
4. Prova veritabanı kaldırıldı.

## Hata durumları (hepsi beklendiği gibi)

| Durum | Sonuç |
|---|---|
| Tablo içeren hedefe geri yükleme | Reddedildi ("restore into an empty database"), çıkış 1 |
| Yedeği açmayan anahtar | Veritabanı oluşturulmadan reddedildi, çıkış 1 |
| Bir baytı değiştirilmiş döküm | sha256 farkıyla reddedildi, çıkış 1 |
| Alıcı dosyası yerine gizli anahtar | Reddedildi, çıkış 2 |
| Olmayan veritabanının yedeği | Hata verdi, arkasında dosya kalmadı |

## Sonuç ve kalanlar

- Prova başarılı (F15 KK3).
- Kalanlar F16.8'de yapılacak:
  - Sunucuda zamanlama, saklama süresi ve ikinci kopya (kullanıcı "drive mantığı" dedi; biçimi sonra kararlaştırılacak).
  - Sağlayıcının WAL/PITR'si.
  - Nesne deposunun sürümlenmesi.
  - Gerçek çevrimdışı anahtarla ilk canlı prova.
