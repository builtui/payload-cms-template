# Neues Projekt aus dem Template starten

Step-by-step-Playbook, wenn du ein neues Projekt auf Basis dieses Templates anlegst. Basiert auf den Learnings aus `ludwigmoeller`, `hugenottenhaus` und `boothside`.

**Zeitaufwand:**
- Phase 1 (Bootstrap → lokal läuft): **~30 Minuten**
- Phase 2 (Customization): abhängig vom Projekt-Scope
- Phase 3 (Production-Setup): **~30 Minuten mit Playbook** (siehe [DEPLOYMENT.md](DEPLOYMENT.md))

---

## Phase 1 — Bootstrap (lokal)

### 1. Repo clonen + initialisieren
```bash
git clone https://github.com/builtui/payload-cms-template.git my-project
cd my-project

# eigenes Git-Repo
rm -rf .git && git init && git add . && git commit -m "initial from template"
git remote add origin <your-repo-url>
```

### 2. Dependencies installieren
```bash
pnpm install
```

### 3. PostgreSQL lokal bereitstellen
```bash
# Mac (brew): bereits installiert? → prüfen
brew services list | grep postgresql
# Ggf. installieren:
brew install postgresql@16 && brew services start postgresql@16

# DB anlegen
createdb my_project
```

### 4. Environment konfigurieren
```bash
cp .env.example .env
```

`.env` editieren:
```env
DATABASE_URL=postgresql://<user>@localhost:5432/my_project
PAYLOAD_SECRET=$(openssl rand -hex 32)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> `PAYLOAD_SECRET` generieren mit `openssl rand -hex 32`. Nie einen default-Wert behalten.

### 5. First Start
```bash
pnpm generate:importmap
pnpm dev
```
→ Öffne http://localhost:3000/admin und lege den ersten Admin-User an.

---

## Phase 2 — Customization

### A. Identitäts-Ebene (Design Tokens)

**Farben + Font** in `src/app/(frontend)/globals.css`:
```css
@theme {
  --color-warm-white: #F5F2ED;
  --color-deep-black: #1A1A1A;
  --color-anthracite: #4A4A4A;
  --color-warm-gray: #B5B0A8;
  --color-line: #D9D5CF;
  --font-sans: "Your Font", system-ui, sans-serif;
}
```

> **Gotcha — Tailwind v4 Token-Naming:** Vermeide redundante Präfixe wie `--color-text-muted`, weil der Utility-Name dann `text-text-muted` wird. Besser: `--color-muted` → `text-muted`. Siehe [LEARNINGS.md](LEARNINGS.md).

**Assets:**
- `public/fonts/` — woff2-Fonts (self-hosted — **kein Google-CDN** wegen DSGVO)
- `public/images/` — Logo, Favicon

### B. Collections definieren

Ein neues Projekt erbt `Users`, `Media`, `Pages` aus dem Template. **Domain-spezifische Collections selbst anlegen** — siehe [FEATURES.md — Pattern-Bibliothek](FEATURES.md) für Inspirationen aus den 3 Referenz-Projekten.

**Best Practices:**
- `admin.useAsTitle` IMMER setzen (bei Upload-Collections: `'filename'`)
- `admin.defaultColumns` — die ersten 3-4 relevantesten Felder
- `admin.listSearchableFields` — NUR Text-like Fields, keine enums → sonst crash ([KNOWN-ISSUES](KNOWN-ISSUES.md))
- `admin.group` — gruppiere die Sidebar nach `'Content'` / `'Settings'` / `'Taxonomy'`
- Bei `localized: true`-Fields immer über `mergeLocalized` gehen bei Seed-Updates — siehe [LEARNINGS.md §2](LEARNINGS.md)
- Für Editor-manageable Tags → **Relationship auf eigene Taxonomy-Collection**, nicht static `select` (siehe CLAUDE.md — Taxonomy Pattern)

### C. Blocks bauen

Blocks sind **nicht im Template enthalten** — du baust sie pro Projekt.

**Konvention:**
- Slug: `m{N}-{name}` (z.B. `m1-hero`, `m2-marquee`)
- Schema in `src/blocks/MyBlock.ts`
- Render-Component in `src/components/blocks/MyBlockBlock.tsx`
- Jeder Block nutzt `makeWrapperFields()` — Editor hat volle Kontrolle über Padding/Background/Dividers/Hidden
- Localized-Fields: `localized: true` auf allen Text-Feldern
- Links: immer `linkField()` — nicht manueller URL-String
- Registry-Listen: `allBlocks` (für Pages), ggf. `detailBlocks` (für Events/Projects), `blogBlocks` (für Posts)

**Erste Check nach jedem neuen Block:**
```bash
pnpm generate:importmap   # WICHTIG bei Custom-Admin-Components
pnpm generate:types       # aktualisiert payload-types.ts
```

**Gotcha:** Wenn ein Block in mehreren Collections verfügbar sein soll, MUSS er in jeder Block-Liste stehen — sonst wird er beim Seed silent gedropt. Siehe [KNOWN-ISSUES](KNOWN-ISSUES.md).

### D. Routes anlegen

`src/app/(frontend)/` — pro Collection die Routes bauen:
- `/page.tsx` — Homepage (fetcht Page mit `isHomepage: true`)
- `/[slug]/page.tsx` — Dynamic Pages (filtert `isHomepage` + `isArchive`)
- `/<collection>/page.tsx` — Index-Route (ersetzt Archive-Page)
- `/<collection>/[slug]/page.tsx` — Detail-Route

**WICHTIG:**
- `generateStaticParams` IMMER mit try/catch (CI-Safety)
- `export const revalidate = 60` für ISR
- Locale aus `params` durchreichen — NICHT aus `headers()` lesen (zerstört ISR)

Update `COLLECTION_PATHS` in `src/components/SmartLink.tsx`, damit Smart-Links korrekt auflösen.

### E. Seed schreiben

```bash
cp src/seed.example.ts src/seed.ts
```

**Seed-Struktur:**
- **Orchestrator** in `src/seed.ts` (dropAll → uploadMedia → seed Collections → seed Globals → DE-overlay)
- **Helpers** in `src/seedHelpers/*.ts` pro Collection
- **Safety:** `ALLOW_SEED=true` als Env-Flag erforderlich (verhindert accidental drops)
- **Assets** in `seed-assets/` Ordner (gitignored)
- **EN-Base + DE-Overlay**: einmal kompletten EN-Content erstellen, dann DE per `p.update({ locale: 'de' })` drüberlegen

**Run:**
```bash
ALLOW_SEED=true pnpm seed
```

**Reset-Workflow (lokal):**
```bash
rm -rf media/
psql -d my_project -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
ALLOW_SEED=true pnpm seed
```

### F. i18n entscheiden

**Pro Projekt wählen:**

1. **Einsprachig** → nichts tun. `payload.config.ts → localization` entfernen oder leer lassen.
2. **Mehrsprachig, Content localized, URLs generisch** (wie ludwigmoeller) → `localization` in Config, Fields mit `localized: true`, aber KEINE Middleware.
3. **Mehrsprachig mit URL-Segmenten** (wie boothside) → [FEATURES.md → i18n URL-Segmente aktivieren](FEATURES.md).

Sobald URL-Segmente: **Locale aus `params` durch jede Route + Component forwarden.** Sonst SSG kaputt.

### G. SEO + Sitemap

- `src/app/robots.ts` — schon da. Blockiert `/admin` + `/api`.
- `src/app/sitemap.ts` — erweitern: queries pro Collection für die Routes.
- `NEXT_PUBLIC_SITE_URL` in `.env` setzen (wird von robots + sitemap gelesen).
- `@payloadcms/plugin-seo` in `payload.config.ts` registrieren — NICHT zusätzlich custom `seoFields` (siehe [KNOWN-ISSUES](KNOWN-ISSUES.md)):
  ```typescript
  seoPlugin({
    collections: ['pages', 'events', 'projects'],
    uploadsCollection: 'media',
    generateTitle: ({ doc }) => doc?.title ? `${doc.title} — My Site` : 'My Site',
    generateDescription: ({ doc }) => doc?.excerpt || '',
  })
  ```

### H. Live Preview konfigurieren

Für jede Content-Collection die Preview-URL im `payload.config.ts` mappen:

```typescript
livePreview: {
  url: ({ data, collectionConfig }) => {
    const slug = collectionConfig.slug
    if (slug === 'pages') return data.slug === 'home' ? '/' : `/${data.slug}`
    if (slug === 'events') return `/events/${data.slug}`
    // ...
    return '/'
  },
  breakpoints: [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1440, height: 900 },
  ],
}
```

### I. GDPR / DSGVO

- **Cookie Banner** ist im Template bereits aktiv (4 Kategorien).
- **CookieConsent Global** aktivieren, wenn der Banner-Text editierbar sein soll. Siehe [FEATURES.md](FEATURES.md).
- **Self-hosted Fonts** (nicht Google-CDN).
- **Self-hosted Icons** (SVGs lokal, kein CDN).
- **Video Consent Gate** nutzen (nicht direkt YouTube-iframes rendern).
- **Impressum + Datenschutz** als Pages anlegen (nicht nur Footer-Link).

---

## Phase 3 — Production

**Folge dem Playbook** in [DEPLOYMENT.md](DEPLOYMENT.md). Kurzfassung:

1. Server provisionieren (Hetzner CX22, Ubuntu 24.04)
2. Base-Pakete installieren (nginx, postgresql-16, certbot, ffmpeg, fail2ban)
3. App-User + Verzeichnisse (`/opt/<app>`)
4. Postgres DB + User (scram-sha-256, localhost only)
5. Code rsyncen, `.env` mit 600
6. `pnpm install` + `pnpm build` + `pnpm payload migrate:create initial --force-accept-warning` + `pnpm payload migrate`
7. PM2 + systemd
8. nginx-Site-Config (mit Basic Auth pre-launch)
9. certbot SSL
10. fail2ban
11. DB-Backup-Cron (täglich, 14d retention)
12. Pre-Launch-Gate raus → Go-Live

**Pre-Launch-Checklist:** Siehe [SECURITY-AUDIT.md](SECURITY-AUDIT.md) — vor dem Entfernen des Basic-Auth-Gates komplett durchgehen.

---

## Projekt-Registry pflegen

Nach Go-Live: Eintrag in [PROJECTS.md](PROJECTS.md) ergänzen:
- Domain, lokaler Pfad
- Stack-Abweichungen vom Template
- Custom-Features, die das Projekt gebaut hat
- Projekt-spezifische Gotchas

So weiß die nächste Session, dass sie hier nachschlagen kann, wenn sie ein ähnliches Feature bauen will.

---

## Checkliste

### Bootstrap (Tag 1)
- [ ] `git clone` + eigenes Remote
- [ ] `pnpm install`
- [ ] PostgreSQL lokal + `createdb`
- [ ] `.env` mit `PAYLOAD_SECRET` (openssl rand -hex 32)
- [ ] `pnpm generate:importmap`
- [ ] `pnpm dev` + Admin-User anlegen

### Content-Architektur
- [ ] Design Tokens + Fonts eingebaut
- [ ] Collections definiert (mit useAsTitle, defaultColumns, admin.group)
- [ ] Blocks gebaut (m1–m…)
- [ ] Routes angelegt (inkl. generateStaticParams try/catch)
- [ ] `COLLECTION_PATHS` in SmartLink ergänzt
- [ ] Seed geschrieben + getestet
- [ ] i18n-Strategie entschieden + implementiert
- [ ] SEO-Plugin konfiguriert
- [ ] Live-Preview-URLs gemapped
- [ ] `pnpm build` lokal fehlerfrei

### GDPR
- [ ] Cookie Banner aktiv (oder CookieConsent Global aktiviert)
- [ ] Fonts lokal, keine CDNs
- [ ] Impressum + Datenschutz als Pages
- [ ] Video-Embeds via Consent-Gate

### Pre-Production
- [ ] Server-Pakete installiert (inkl. ffmpeg wenn Video!)
- [ ] DB + User (least privilege, scram-sha-256)
- [ ] `.env` auf 600, app:app
- [ ] PM2 + systemd
- [ ] nginx + SSL + security headers
- [ ] fail2ban
- [ ] DB-Backup-Cron
- [ ] Basic Auth pre-launch aktiv
- [ ] `pnpm prewarm` läuft
- [ ] Images laden (trotz Basic Auth — `auth_basic off` auf `/_next/image`)

### Go-Live
- [ ] [SECURITY-AUDIT.md](SECURITY-AUDIT.md) komplett durchgelaufen
- [ ] HSTS auf 31536000 hochgedreht
- [ ] X-Robots-Tag "noindex" entfernt
- [ ] Basic Auth raus
- [ ] Sitemap + robots.txt prüfen
- [ ] Canonical-Domain + 301s konfiguriert
- [ ] Uptime-Check (UptimeRobot o.ä.) eingerichtet
- [ ] Eintrag in [PROJECTS.md](PROJECTS.md) hinzugefügt
