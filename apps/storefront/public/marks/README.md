# Ödeme ve kargo işaretleri

Alt bilgideki ödeme ve kargo işaretleri (`lib/views/card-extras.ts` `MARK_LOGOS`), dosya adı backend'in anahtarıdır (`workflows/storefront/shop-marks.ts`). Her dosya sağlayıcının kendi sitesinden, olduğu gibi indirildi (2026-11-05); elle çizilmedi, değiştirilmedi. SVG'lerde betik, dış bağlantı ya da gömülü görsel yok (indirirken bakıldı; yeni dosyada yine bakılır).

| Dosya | Kaynak |
| --- | --- |
| `visa.png` | https://cdn.visa.com/v2/assets/images/logos/visa/blue/logo.png (visa.com.tr'nin Organization JSON-LD'sindeki logo) |
| `mastercard.svg` | https://www.mastercard.com/content/dam/brandcenter/assets/images/logos/mclogo-for-footer.svg (Mastercard Brand Center) |
| `troy.svg` | https://www.troyodeme.com/upload/cmspagefile/file/medya-merkezi/TROY-Logolar.zip → `SVG/TROY Logo.svg` (TROY Medya Merkezi) |
| `paytr.png` | https://www.paytr.com/wp-content/uploads/logo-1.png (paytr.com üst bilgi logosu) |
| `iyzico.svg` | https://www.iyzico.com/assets/uploads/zip/BeyazZemindeKullanim.zip → `iyzico-white-bg.svg` (iyzico Marka Kılavuzu) |
| `aras.svg` | https://www.araskargo.com.tr/aras-nav-logo.svg (araskargo.com.tr üst bilgi logosu) |
| `yurtici.svg` | https://www.yurticikargo.com/web_files/yurtici-kargo/assets/img/logo.svg (yurticikargo.com üst bilgi logosu) |

Havale/EFT ve kapıda ödeme bir şirketin işareti değildir: tema simgesiyle ve adıyla çizer.
