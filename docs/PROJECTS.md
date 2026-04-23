# Projects — Registry

Projekte, die aus diesem Template abgeleitet wurden. Pro Eintrag: wo liegt's, was macht's, was ist spezifisch.

Zweck: Wenn eine neue Session etwas bauen soll und sich fragt "wie wurde das schon mal gelöst?" → hier erstmal schauen, dann die passende Projekt-Codebase als Referenz nehmen.

---

## Übersicht

| Projekt | Domain | Lokaler Pfad | Zweck |
|---|---|---|---|
| **ludwigmoeller** | ludwigmoeller.de | `/Users/bugbox/dev/ludwigmoeller/payload` | Coaching/Therapy-Portfolio Dr. Ludwig Möller |
| **hugenottenhaus** | hugenottenhaus.de | `/Users/bugbox/dev/hugenottenhaus/payload` | Kulturhaus Kassel (Events + Künstler:innen) |
| **boothside** | boothside.com | `/Users/bugbox/dev/xrealities/booth2content/cms` | Messestand-Foto/Video-Service |

---

## ludwigmoeller (Dr. Ludwig Möller)

**Stack:**
- Payload 3.81.0 / Next.js 16.2.2 / React 19.1.0 / Tailwind 4.2.2 / PostgreSQL 16
- Deployment: **Docker + docker-compose + Caddy** (SSL via Caddy, Let's Encrypt)
- Hosting: Hetzner Cloud CX22 (Ubuntu 24.04)

**Collections (8):** Users, Media, Pages, Projects, ArtWorks, Testimonials, Awards, Qualifications
**Globals (3):** SiteSettings, Navigation, Footer
**Blocks (16):** m1–m16, inkl. Spezial-Blocks `m9-offering` (Coaching/Therapy 2-Spalter), `m16-bento` (ArtWorks-Kachel-Grid)

**Besonderheiten:**
- **Video-Transcode-Hook** (MP4/MOV → WebM via ffmpeg, fire-and-forget)
- **Content Localized** (DE default + EN), aber **keine URL-Segmente** — Content ist lokalisiert, URLs bleiben generisch
- **Seed mit konkreten Ludwig-Daten** (nicht Dummy) — NIEMALS auf Prod ausführen
- **Migrations in `src/migrations/`** vorhanden (`20260422_171110_initial`), aber `payload.config.ts` hat noch `push: process.env.PAYLOAD_DB_PUSH !== 'false'` aktiv — Go-Live-Checklist: `PAYLOAD_DB_PUSH=false`
- Custom Fields: `slugField`, `linkField`, `makeWrapperFields`, `slugify` — alle reusable
- SEO-Titel: `{title} — Dr. Ludwig Möller`

**Gotchas spezifisch:**
- `docs/LEARNINGS.md` im Projekt-Ordner enthält Tailwind-v4-Token-Naming-Gotcha (`--color-text-muted` → `text-text-muted` redundant)
- DSGVO: Self-hosted Fonts (Inter + Lora), kein Google-CDN
- Live-Preview-URLs hardcoded in `payload.config.ts` — neue Collections manuell ergänzen

**Docs im Projekt:** `README.md`, `CLAUDE.md`, `docs/MODULES.md`, `docs/LEARNINGS.md`

---

## hugenottenhaus (Kulturhaus Kassel)

**Stack:**
- Payload 3.81.0 / Next.js 16.2.2 / React 19.1.0 / Tailwind 4.2.2 / PostgreSQL 16
- Deployment: **nicht konfiguriert** (nur lokale Dev-Umgebung zum Zeitpunkt der Analyse)
- Node 22.22.2, pnpm 10.33.0

**Collections (8):** Users, Media, EventTypes, Events, EventRegistrations, Artists, Projects, Pages
**Globals (3):** SiteSettings, Navigation, Footer
**Blocks (22):** m1–m17b, inkl. Event-List, Artist-Marquee, Registration-CTA, Newsletter

**Besonderheiten:**
- **Event-Registration-System**: `POST /api/events/register` mit Validierung, Duplikat-Check, Kapazitäts-Limit, Email-Versand (Resend/Nodemailer/Stub-Fallback)
- **Artist-Marquee** (`m11-artist-marquee`): Server-Component (Data) + Client-Component (Cursor-Portrait)
- **Event-Types-Taxonomie**: separate Collection (Workshop, Talk, etc.)
- **Routes**: `/programm/[slug]`, `/programm/[slug]/anmeldung`, `/programm/[slug]/anmeldung/danke`, `/kuenstlerinnen/[slug]`, `/projekte/[slug]`
- **Email-System** (`src/lib/email.ts`): progressiver Fallback Resend → Nodemailer → console.log
- Live-Preview für 4 Collections konfiguriert (pages, events, artists, projects)

**Gotchas spezifisch:**
- **Kein Dockerfile, keine PM2-Config, keine nginx-Config** — Deployment-Config fehlt im Repo
- **Production-Domain nicht in `next.config.ts` remotePatterns** — TODO-Kommentar
- **Race-Condition** beim Capacity-Check minimal (kein SELECT FOR UPDATE — für zweistellige Teilnehmerzahlen ok)
- Email optional dependencies (`resend`, `nodemailer`) mit `@ts-expect-error` — werden dynamisch importiert nur bei entsprechender Env-Konfig

**Docs im Projekt:** `TEMPLATE.md` (310 Zeilen, deckt Architektur + Stolpersteine + Template-Vorbereitung + DSGVO-Checkliste)

---

## boothside (xrealities / Messestand-Service)

**Stack:**
- Payload 3.81.0 / Next.js 16.2.2 / React 19.1.0 / Tailwind 4.2.2 / PostgreSQL 16
- Email: **Postmark** (Prod) / nodemailer (Dev) via `@payloadcms/email-nodemailer`
- Deployment: **PM2 + systemd + nginx + Let's Encrypt + fail2ban**
- Hosting: Hetzner Cloud CX22 (4GB RAM), Ubuntu 24.04
- User: `boothside`, Pfade `/opt/boothside/`, Media `/var/lib/boothside/media`, DB-Backups `/var/backups/postgresql/`, Image-Cache `/var/cache/nginx/images/`
- Staging: `boothside.sht.wtf`

**Collections (11):** Users, Media, Pages, Events, Work, Posts, FAQItems, PackageTiers, Categories, Tags, FormSubmissions
**Globals (4):** SiteSettings, Navigation, Footer, CookieConsent
**Blocks (22):** m1–m22

**Besonderheiten:**
- **i18n URL-Segmente** (`/en/…`, `/de/…`) via Middleware, locale aus `params` durchgereicht
- **EN-default + DE-overlay Seed-Pattern** mit `mergeItems()` Helper (löst Localized-Array-Quirk)
- **Package-Configurator** (m15): interaktiver Preis-Builder mit 5 Tiers (Starter/Story/Day/Pool/Bundle) × Photo/Video/Bundle-Mix
- **Trade-Shows mit `hasDetailPage`-Flag** (automatisch gesetzt wenn Layout nicht leer)
- **Blog mit Reading-Time** (Lexical word-count → min read)
- **Form-Submit + Honeypot + Rate-Limit** (nginx `limit_req_zone`)
- **Archive-Pages-Pattern** (`isArchive: true` für /work, /blog, /trade-shows)
- **Image-Pre-Warming** (`scripts/prewarm-images.sh` Post-Deploy)
- **2 Migrations** in `src/migrations/`: `20260420_195031` (init), `20260420_203725_add_m14_prose_to_pages`

**Gotchas spezifisch:**
- **SSH-Zugang über 1Password-Agent** (separate SSH_AUTH_SOCK-Env-Var nötig)
- **ffmpeg NICHT installiert** aktuell — gut, da keine Video-Collection nutzt. Bei künftigen Video-Uploads: `apt install ffmpeg` + `systemctl restart pm2-boothside`
- **SSH-Config** nutzt `IdentityFile` mit **Public Key** (1Password hält private intern)
- **`.htpasswd` auf 640 root:www-data** (nicht default 644)

**Docs im Projekt:**
- `README.md` (110 Zeilen) — Local Dev Setup
- `CLAUDE.md` (204 Zeilen) — Template-Doku
- `docs/LEARNINGS-boothside.md` (**1103 Zeilen** — Haupt-Wissensquelle)
- `docs/SECURITY-AUDIT-checklist.md` (407 Zeilen) — Pre-Launch + Quarterly

**Dieses Projekt war die primäre Quelle für das Template-Learnings.**

---

## Feature-Vergleich

Siehe [FEATURES.md — Feature-Matrix](FEATURES.md).

---

## Wie man ein Referenz-Projekt durchsucht

Wenn du als Session wissen willst "wie hat Projekt X Feature Y gelöst":

```bash
# Beispiel: wie ist Event-Registration im hugenottenhaus-Projekt gebaut?
cd /Users/bugbox/dev/hugenottenhaus/payload
grep -r "registration" src/ --include="*.ts" --include="*.tsx" -l

# Beispiel: welche Blocks nutzt boothside?
ls /Users/bugbox/dev/xrealities/booth2content/cms/src/blocks/

# Beispiel: wie wurde i18n-Middleware umgesetzt?
cat /Users/bugbox/dev/xrealities/booth2content/cms/src/middleware.ts
```

Vor Ort sind die **Source of Truth** für "was wurde wirklich gebaut". Die Template-Docs sind die **verdichtete Version**. Wenn ein Pattern in mehreren Projekten erscheint → Template-Kandidat.

---

## Wartung dieser Datei

Wenn ein neues Projekt das Template ableitet:
1. Sektion hinzufügen: Stack, Collections, Globals, Blocks, Besonderheiten, Gotchas, Docs im Projekt
2. Feature-Matrix in `FEATURES.md` erweitern
3. Wenn Besonderheit verallgemeinerbar → ins `FEATURES.md` Pattern-Bibliothek + `LEARNINGS.md`
4. Wenn ein Gotcha hier Muster sein könnte → `KNOWN-ISSUES.md`

Wenn ein Projekt abgeschaltet / archiviert wird: Sektion markieren statt löschen. Die Learnings bleiben wertvoll.
