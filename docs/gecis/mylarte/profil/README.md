# mylarte mağaza profili

Geliştirme mağazasını mylarte'nin yapısıyla kurar: mağaza adı ve iletişim, yasal kimlik, ücretsiz kargo eşiği, ana sayfa SEO'su ve girişi, duyuru şeridi, üst bağlantılar, menü, alt bilgi sütunları, güven rozetleri, WhatsApp, marka rengi (`#076599`), 12 içerik sayfası (`../sayfalar/`) ve taşıma paketi (`paket.json`: 48 kategori, 13 marka, eski adresleriyle).

```sh
pnpm --filter @qticaret/backend shop:profile ../../docs/gecis/mylarte/profil hide-demo
```

- Tekrar çalıştırılabilir: ayarlar ve sayfalar güncellenir, taşıma kaynak anahtarıyla aynı kayıtları bulur, çoğaltmaz.
- `hide-demo`: demo tohumunun kategorileri vitrinden kalkar (kayıtlar durur; demo ürünler ve ödeme deneme sayfası onları kullanır).
- Eski mylarte adreslerinden 301'ler taşımanın kesim adımında uygulanır (`docs/runbooks/gecis.md`), şimdi değil.
- Ürünleri mağaza sahibi ekler. Menüdeki ve alt bilgideki kategori adresleri taşımanın ürettiği adreslerdir (`/kategori/{üst}/{alt}`); adres stili kararı `../esleme.md` §3.
- Henüz vitrinde olmayan sayfalara bağlantı verilmedi: Yorumlar, Hesabım, Tüm Ürünler (`/magaza`).
