# 09 — Claude Code Çalışma Düzeni

## Token yönetimi
1. **Kademeli bağlam.** Kök `CLAUDE.md` kısa; detaylar `docs/`'ta. Claude sadece görevle ilgili dokümanı okur.
2. **İç içe CLAUDE.md.** `apps/backend/CLAUDE.md` gibi alt dosyalar sadece o klasörde çalışırken yüklenir.
3. **Tek oturum = tek görev.** Görev bitince `/oturum-kapat` → `/clear`. Uzun oturumlarda `/compact`.
4. **Plan modu önce.** Çok dosyalı işlerde önce plan; onaydan sonra kod. Plan `PROGRESS.md`'ye not edilir.
5. **Alt ajanlarla keşif.** Kod tabanı taraması, doküman araştırması `medusa-researcher` ajanına; ana bağlam temiz kalır.
6. **Durum dosyada.** İlerleme, kararlar, açık sorular `PROGRESS.md` ve `adr/`'de; sohbet geçmişine güvenme.
7. **Gürültüyü engelle.** `node_modules`, `dist`, `.medusa`, lockfile, büyük log'lar okunmaz (settings deny).
8. **Çıktıyı kısalt.** Test/komut çıktılarında sadece hatalar: `pnpm test 2>&1 | tail -50` gibi.
9. **Küçük dosyalar.** 300 satır sınırı Claude'un dosyayı tek seferde doğru okumasını sağlar.

## MCP sunucuları
| MCP | Ne zaman | Kurulum (örnek) |
|---|---|---|
| Context7 | **Her zaman açık.** Medusa/kütüphane API doğrulama | `.mcp.json` içinde |
| GitHub | PR/issue işlerinde | `claude mcp add --transport http github https://api.githubcopilot.com/mcp/` |
| Playwright | Admin UI test/gezinti | `.mcp.json` içinde |
| PostgreSQL (dev, salt-okunur) | Şema/veri inceleme | Salt-okunur kullanıcıyla, **sadece local DB** |
| Sentry | F10 sonrası hata analizi | Gerektiğinde ekle |

> MCP paket adları ve kurulum komutları değişebilir; kurmadan önce resmi kaynaktan doğrula.
> Kural: aynı anda en fazla 3-4 MCP aktif. Her MCP araç tanımlarıyla bağlam tüketir.
> Production DB'ye, prod secret'lara MCP erişimi **yok**.

## Özel komutlar (`.claude/commands/`)
| Komut | Amaç |
|---|---|
| `/oturum-baslat` | PROGRESS'i oku, sıradaki görevi öner, ilgili dokümanları listele |
| `/faz-baslat <F#>` | Fazın görevlerini ve KK'larını çıkar, plan üret |
| `/yeni-modul <ad>` | Medusa özel modül iskeleti (models, service, index, migration, test) |
| `/entegrasyon-provider <tür> <ad>` | Payment/fulfillment/notification provider iskeleti + mock + contract test |
| `/test-yaz <yol>` | Hedef dosya için test senaryoları + testler |
| `/guvenlik-review` | Değişen dosyaları güvenlik kontrol listesine göre incele |
| `/oturum-kapat` | PROGRESS güncelle, KK'ları işaretle, sonraki görevi yaz |

## Alt ajanlar (`.claude/agents/`)
| Ajan | Rol |
|---|---|
| `medusa-researcher` | Salt-okunur. Context7 + kod tabanında araştırma, kısa özet döner |
| `security-reviewer` | Salt-okunur. Güvenlik kontrol listesi, bulgu raporu |
| `test-writer` | Test senaryosu çıkarır, test yazar, çalıştırır |
| `code-reviewer` | Standartlara uyum, sadeleştirme önerileri |

## Hook'lar
`.claude/settings.json` içinde: dosya düzenlemesinden sonra prettier (jq gerektirir).
Ağır işler (tam test, build) hook'a konmaz; token ve süre israfı.

## Önerilen oturum akışı
```
/oturum-baslat
→ (plan modu) görev planı → onay
→ kod + test
→ /test-yaz (gerekirse) → pnpm test
→ /guvenlik-review (ödeme/kargo/fatura/auth değiştiyse)
→ commit (conventional)
→ /oturum-kapat → /clear
```

## Claude'a verilmeyecek yetkiler
- `git push --force`, `rm -rf`, prod deploy komutları
- `.env*` okuma, secret dosyaları
- Paket yayımlama (`npm publish`)
