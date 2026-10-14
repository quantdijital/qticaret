# Platform Dokümantasyon Paketi

E-ticaret altyapı platformu için Claude Code çalışma dokümanları (Backend + Admin aşaması).

## Kurulum
1. Bu klasörün içeriğini **repo köküne** kopyalayın (`apps/backend/CLAUDE.md` yerine oturur).
2. `jq` kurulu olsun (prettier hook'u için).
3. MCP'leri kontrol edin: `claude` → `/mcp`. `.mcp.json` Context7 ve Playwright içerir; GitHub vb. ihtiyaç anında eklenir.
4. Claude Code'da ilk komut: `/oturum-baslat`

## İçerik
- `CLAUDE.md` — kök bağlam (kısa)
- `PROGRESS.md` — oturumlar arası ilerleme
- `docs/` — mimari, yol haritası, güvenlik, performans, admin UX, test, devops, çalışma düzeni, standartlar, entegrasyonlar
- `adr/` — mimari karar kayıtları
- `.claude/commands` — özel komutlar, `.claude/agents` — alt ajanlar, `.claude/settings.json` — izinler ve hook'lar

## Not
Medusa ve sağlayıcı API'leri değişebilir. Dokümanlar tasarım rehberidir; kod yazmadan önce
Claude Code Context7 ve resmi dokümanlarla doğrulama yapacak şekilde yapılandırılmıştır.
