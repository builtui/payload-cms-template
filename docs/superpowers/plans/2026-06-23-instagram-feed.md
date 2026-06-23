# Instagram-Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein DSGVO-sauberer Instagram-Feed: Posts serverseitig über die Graph API ziehen, Medien selbst hosten, in einem Payload-Block (horizontal/vertikal) mit Insta-Style-Popup rendern — ohne Consent-Gate.

**Architecture:** Drei Schichten — `instagram-posts`-Collection (Daten) ← Sync-Job (Graph API → self-hosted Media) ← OAuth-Connect im Admin. Frontend: `m22-instagram-feed`-Block (Server-Component) + Client-Popup. Erst-Implementierung in `Tatiana Liss/cms`, gekapselt für spätere Promotion ins Template.

**Tech Stack:** Payload v3, Next 16, Postgres, Tailwind v4, ffmpeg (Video-Transcode, bestehende Pipeline). Meta Graph API („Instagram API with Instagram Login").

**Verifikation in diesem Projekt:** kein Unit-Test-Framework. „Test eines Schritts" = `pnpm lint` (0), `pnpm generate:types` + `tsc` (sauber), Schema-Push, Demo-Seite per `curl` (200 + erwarteter Inhalt), `psql`-Row-Check. Häufig committen.

**Zwei Phasen:**
- **Phase 1 (Daten + Modul + Popup)** — unblocked, sofort baubar gegen Dummy-Seed. Liefert ein funktionierendes, sichtbares Modul.
- **Phase 2 (Sync + OAuth)** — gated auf die Meta-Dev-App (App-ID/Secret aus Anhang A des Specs). Code ist gegen Metas **dokumentierten** Contract spezifiziert; die exakten Response-Feldformen beim ersten Lauf gegen die Live-Dev-App verifizieren (Standard bei Fremd-API-Integration).

Spec: `docs/superpowers/specs/2026-06-23-instagram-feed-design.md`.

---

## File Structure

**Phase 1**
- Create: `cms/src/collections/InstagramPosts.ts` — Collection-Schema (Job-gepflegt).
- Modify: `cms/src/payload.config.ts` — Collection registrieren.
- Create: `cms/src/blocks/InstagramFeed.ts` — Block-Schema (m22, variant/count/heading).
- Modify: `cms/src/blocks/index.ts` — in `allBlocks` (+ ggf. detail/blog) eintragen.
- Create: `cms/src/components/blocks/InstagramFeedBlock.tsx` — Render (Server), Horizontal/Vertical.
- Create: `cms/src/components/blocks/InstagramPopup.tsx` — Client-Lightbox (Insta-Optik).
- Modify: `cms/src/components/RenderBlocks.tsx` — blockType → Component.
- Create: `cms/src/seed-instagram-dummy.ts` — Dummy-Posts für Build/QA (tsx, tsconfig-excluded).

**Phase 2**
- Create: `cms/src/globals/InstagramConnection.ts` — Token/Status-Global (Token `access.read:()=>false`).
- Modify: `cms/src/payload.config.ts` — Global registrieren.
- Create: `cms/src/app/(payload)/api/instagram/connect/route.ts` — OAuth-Start (Redirect zu Meta).
- Create: `cms/src/app/(payload)/api/instagram/callback/route.ts` — Code→Token, speichern.
- Create: `cms/src/admin/InstagramConnect.tsx` — Admin-Button + Status (Custom-Component).
- Create: `cms/src/lib/instagram/graph.ts` — Graph-API-Client (fetch media, token-exchange/refresh).
- Create: `cms/src/lib/instagram/ingest.ts` — Media download + self-host (+ Video-Transcode) + upsert.
- Create: `cms/scripts/sync-instagram.mjs` — Cron-Entry (liest Global, ruft ingest).
- Modify: deploy/cron — Sync alle 6 h.

---

## PHASE 1 — Daten + Modul + Popup (sofort baubar)

### Task 1: Collection `instagram-posts`

**Files:**
- Create: `cms/src/collections/InstagramPosts.ts`
- Modify: `cms/src/payload.config.ts`

- [ ] **Step 1: Collection-Schema schreiben**

```ts
// cms/src/collections/InstagramPosts.ts
import type { CollectionConfig } from 'payload'

export const InstagramPosts: CollectionConfig = {
  slug: 'instagram-posts',
  labels: { singular: 'Instagram-Post', plural: 'Instagram-Posts' },
  admin: {
    group: 'Instagram',
    useAsTitle: 'igId',
    defaultColumns: ['igId', 'mediaType', 'timestamp', 'hidden'],
    description: 'Wird automatisch vom Sync-Job gepflegt. „Ausgeblendet" versteckt einen Post im Feed.',
  },
  access: { read: () => true },
  fields: [
    { name: 'igId', type: 'text', required: true, unique: true, admin: { readOnly: true } },
    { name: 'permalink', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'caption', type: 'textarea', admin: { readOnly: true } },
    { name: 'timestamp', type: 'date', required: true, admin: { readOnly: true } },
    {
      name: 'mediaType', type: 'select', required: true, admin: { readOnly: true },
      options: [
        { label: 'Bild', value: 'image' },
        { label: 'Video', value: 'video' },
        { label: 'Carousel', value: 'carousel' },
      ],
    },
    { name: 'media', type: 'upload', relationTo: 'media', admin: { description: 'Hauptbild / Video-Poster.' } },
    { name: 'video', type: 'upload', relationTo: 'media', admin: { condition: (_, s) => s?.mediaType === 'video' } },
    {
      name: 'carousel', type: 'array', labels: { singular: 'Carousel-Bild', plural: 'Carousel-Bilder' },
      admin: { condition: (_, s) => s?.mediaType === 'carousel' },
      fields: [{ name: 'image', type: 'upload', relationTo: 'media', required: true }],
    },
    { name: 'hidden', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar', description: 'Aus dem Feed ausblenden (Post bleibt erhalten).' } },
  ],
}
```

- [ ] **Step 2: In payload.config registrieren**

In `cms/src/payload.config.ts` `InstagramPosts` importieren und ins `collections`-Array aufnehmen (bei den übrigen Collections).

- [ ] **Step 3: Verifizieren**

Run: `cd cms && pnpm generate:types && pnpm lint`
Expected: tsc/lint sauber; Dev-Server-Restart pusht das Schema; Collection erscheint im Admin unter „Instagram".
Run: `psql "$DATABASE_URL" -c "\dt instagram_posts*"` → Tabelle existiert.

- [ ] **Step 4: Commit**

```bash
git add cms/src/collections/InstagramPosts.ts cms/src/payload.config.ts cms/src/payload-types.ts
git commit -m "feat(instagram): instagram-posts collection"
```

---

### Task 2: Dummy-Seed (damit Modul + Popup gebaut/verifiziert werden können)

**Files:**
- Create: `cms/src/seed-instagram-dummy.ts`
- Modify: `cms/tsconfig.json` (exclude)

- [ ] **Step 1: Seed-Script schreiben** — legt 6 Dummy-Posts an (mix image/video/carousel), nutzt vorhandene Media-Docs (per `payload.find({collection:'media', limit})`) als Bilder, setzt `permalink='https://instagram.com/p/DUMMY'`, gestaffelte `timestamp`. Muster: bestehende `seed-*.ts` (dotenv + getPayload + relative `./payload.config`).

- [ ] **Step 2: tsconfig exclude** — `"src/seed-instagram-dummy.ts"` in `cms/tsconfig.json` `exclude` (wie die anderen Seed-Skripte, sonst tsc-Build-Fehler).

- [ ] **Step 3: Verifizieren**

Run: `cd cms && ALLOW_SEED=true pnpm exec tsx src/seed-instagram-dummy.ts`
Run: `psql "$DATABASE_URL" -tAc "SELECT count(*) FROM instagram_posts"` → 6.

- [ ] **Step 4: Commit** — `feat(instagram): dummy seed for module QA`.

---

### Task 3: Block-Schema `m22-instagram-feed`

**Files:**
- Create: `cms/src/blocks/InstagramFeed.ts`
- Modify: `cms/src/blocks/index.ts`

- [ ] **Step 1: Block-Schema schreiben**

```ts
// cms/src/blocks/InstagramFeed.ts
import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const InstagramFeed: Block = {
  slug: 'm22-instagram-feed',
  labels: { singular: 'M22 Instagram-Feed', plural: 'M22 Instagram-Feed' },
  fields: [
    {
      name: 'variant', type: 'select', defaultValue: 'horizontal',
      options: [
        { label: 'Horizontal (Scroll-Reihe)', value: 'horizontal' },
        { label: 'Vertikal (Grid)', value: 'vertical' },
      ],
      admin: { description: 'Layout des Feeds.' },
    },
    { name: 'heading', type: 'text', localized: true, admin: { description: 'Optionale Überschrift über dem Feed.' } },
    { name: 'count', type: 'number', defaultValue: 8, min: 1, max: 24, admin: { description: 'Wie viele der neuesten Posts anzeigen (1–24).' } },
    makeWrapperFields({ paddingTop: 'lg', paddingBottom: 'lg' }),
  ],
}
```

- [ ] **Step 2: Registrieren** — `InstagramFeed` in `cms/src/blocks/index.ts` importieren + zu `allBlocks` (und ggf. den anderen Block-Listen) hinzufügen.

- [ ] **Step 3: Verifizieren** — `pnpm generate:types && pnpm lint`; Schema-Push; Block im Page-Builder wählbar.

- [ ] **Step 4: Commit** — `feat(instagram): m22 instagram-feed block schema`.

---

### Task 4: Render-Component `InstagramFeedBlock.tsx`

**Files:**
- Create: `cms/src/components/blocks/InstagramFeedBlock.tsx`
- Modify: `cms/src/components/RenderBlocks.tsx`

- [ ] **Step 1: Server-Render schreiben** — Props `{ variant, heading, count, wrapper }`. Async Server-Component: `payload.find({ collection:'instagram-posts', where:{ hidden:{ not_equals:true } }, sort:'-timestamp', limit:count, depth:1 })`. Rendert pro Post eine Kachel (PayloadImage des `media`, Video-Badge bei `mediaType==='video'`, Carousel-Badge). `variant==='horizontal'` → `flex gap-4 overflow-x-auto snap-x` Reihe; `vertical` → responsives Grid (`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`). Jede Kachel ist ein Trigger fürs Popup (Task 5/6) — Daten als Props an einen Client-Wrapper. In `BlockWrapper` einbetten. Optionales `heading` als h2. Muster: `ReelsBlock.tsx` / `PortfolioGridBlock.tsx`.

- [ ] **Step 2: In RenderBlocks verdrahten** — `'m22-instagram-feed' → InstagramFeedBlock`.

- [ ] **Step 3: Verifizieren** — Demo-Seite mit dem Block anlegen (oder bestehende Demo-Mechanik), dann:
Run: `curl -s http://localhost:3000/<demo> | grep -c '/api/media/file/'` → > 0 (Kacheln rendern).
`pnpm lint && pnpm generate:types` sauber.

- [ ] **Step 4: Commit** — `feat(instagram): instagram-feed render (horizontal/vertical)`.

---

### Task 5: Popup `InstagramPopup.tsx` (Client, Insta-Optik)

**Files:**
- Create: `cms/src/components/blocks/InstagramPopup.tsx`

- [ ] **Step 1: Client-Lightbox schreiben** — `'use client'`. Props: der Post (media/video/carousel URLs, caption, timestamp, permalink) + der `@handle` (aus SiteSettings, durchgereicht). State: offen/zu + Carousel-Index. Layout Insta-typisch: großes Medium links/oben, Meta rechts/unten (Profilname (Link → `https://instagram.com/<handle>`), Datum, Caption, „Auf Instagram ansehen" → `permalink`, `target=_blank rel=noopener`). Carousel: Prev/Next + Dots. Video: `<video controls playsInline>` mit self-hosted `webm` + Poster. Schließen per Backdrop/ESC. `createPortal(…, document.body)` (Stacking-Falle, siehe MobileMenu-Muster). Reine Outbound-Links — kein Tracker.

- [ ] **Step 2: Verifizieren** — auf der Demo-Seite Kachel klicken → Popup öffnet, Caption/Datum/Links korrekt, Carousel blättert, Video spielt, ESC schließt. (Headless: `curl` zeigt die eingebetteten Popup-Daten/`permalink` im Markup.) `pnpm lint` sauber.

- [ ] **Step 3: Commit** — `feat(instagram): instagram-style click popup`.

---

### Task 6: Popup an den Feed koppeln

**Files:**
- Modify: `cms/src/components/blocks/InstagramFeedBlock.tsx` (+ ggf. ein kleiner Client-Wrapper `InstagramFeedClient.tsx` für den Klick-State)

- [ ] **Step 1:** Klick auf eine Kachel öffnet das Popup mit den Daten des Posts (Server gibt die serialisierten Post-Daten + `@handle` an den Client-Wrapper; Wrapper hält „welcher Post offen"-State und rendert `InstagramPopup`).

- [ ] **Step 2: Verifizieren** — Demo: jede Kachel öffnet das richtige Popup. `pnpm lint && pnpm build` (webpack) sauber.

- [ ] **Step 3: Commit** — `feat(instagram): wire popup into feed`.

> **Phase 1 fertig:** funktionierendes, sichtbares Modul gegen Dummy-Daten. Reviewbar/abnehmbar ohne Meta.

---

## PHASE 2 — Sync + OAuth (gated: braucht Meta-Dev-App)

> Voraussetzung: Anhang A des Specs Phase 1 erledigt (App-ID/Secret in `.env` als `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET`, Redirect-URI registriert, Tatianas Account als Tester). **Beim ersten Lauf die realen Graph-API-Response-Felder gegen den Code abgleichen.**

### Task 7: Global `instagram-connection` (Token/Status)

- [ ] Global `cms/src/globals/InstagramConnection.ts`: `connected` (checkbox, readOnly), `igUserId`, `handle`, `accessToken` (text, **`access:{ read: () => false }`**, nie via API ausgegeben; verschlüsselt ablegen), `tokenExpiresAt`, `lastSyncedAt`, `lastError`. In payload.config registrieren. Admin-Group „Instagram". **Verifizieren:** generate:types/lint; Global im Admin; `accessToken` nicht in der REST-Antwort.
- [ ] Commit `feat(instagram): connection global (token, server-only)`.

### Task 8: OAuth-Connect (Admin-Button + Routes)

- [ ] `cms/src/admin/InstagramConnect.tsx`: Custom-Admin-Component, zeigt Status (aus dem Global) + Button „Mit Instagram verbinden" (→ `/api/instagram/connect`) / „Trennen". Nach `generate:importmap` einbinden.
- [ ] `connect/route.ts`: baut die Meta-OAuth-URL (App-ID, `scope=instagram_business_basic`, Redirect-URI, `state`-CSRF-Token) und redirected dorthin.
- [ ] `callback/route.ts`: empfängt `code` → Token-Exchange (Short→Long-Lived, mit App-Secret, serverseitig) → ermittelt `ig user id` + `username` → schreibt ins Global (`payload.updateGlobal`). `state` prüfen.
- [ ] **Verifizieren:** im Dev-Mode mit Tatianas Tester-Account den Flow durchklicken → Global zeigt `connected=true`, `handle`. (Das ist der „≥1 erfolgreiche API-Call", den Meta fürs Review verlangt.)
- [ ] Commit `feat(instagram): OAuth connect flow`.

### Task 9: Graph-Client + Ingest + Sync-Script

- [ ] `lib/instagram/graph.ts`: `getMedia(token, igUserId, limit)` → ruft `/{ig-user-id}/media?fields=id,caption,media_type,media_url,permalink,timestamp,children{media_url,media_type}` (Felder gegen Live-Response verifizieren), `refreshToken(token)` (Long-Lived erneuern).
- [ ] `lib/instagram/ingest.ts`: pro Post — Medium herunterladen, in Payload-Media hochladen (`payload.create({collection:'media', file})`); Video durch die bestehende Transcode-Pipeline (ffmpeg → webm + Poster, siehe `scripts/transcode-video.sh` / Reels); Carousel-Children einzeln; dann `instagram-posts` **upsert** über `igId` (find → create/update). Idempotent.
- [ ] `cms/scripts/sync-instagram.mjs`: Global lesen → Token (ggf. refresh) → `getMedia` → `ingest` → `lastSyncedAt`/`lastError` setzen; bei Fehler Admin-Mail (bestehender Mail-Weg). tsconfig-exclude falls nötig.
- [ ] **Verifizieren:** `pnpm exec node cms/scripts/sync-instagram.mjs` gegen den Tester-Account → echte Posts erscheinen in `instagram-posts`, Bilder/Videos liegen self-hosted in `media/`; das Modul aus Phase 1 zeigt jetzt **echte** Daten.
- [ ] Commit `feat(instagram): graph sync + media self-hosting`.

### Task 10: Cron + Go-Live

- [ ] Sync per Cron alle 6 h (Muster: DB-Backup-Cron `/etc/cron.d`/`cron.daily`). `.env`: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`.
- [ ] Auf `tl.sht.wtf` deployen; Redirect-URI der Domain in der Meta-App; nach Meta-App-Review (Anhang A Phase 4) live für alle Kunden.
- [ ] Commit + Deploy via `scripts/deploy.sh`.

---

## Self-Review (Plan ↔ Spec)
- **Spec-Coverage:** Datenquelle/Graph-API → T8/T9. Post-Typen image/carousel/video → Collection T1 + Ingest T9 + Popup T5. Horizontal/vertical + count → T3/T4. Popup mit Meta + Links → T5/T6. Token/Secrets-Split → T7 (+ `.env`). DSGVO (self-host) → T9 Ingest. Sync-Takt/hidden/count-Defaults → T3 (count 8), T1 (hidden), T10 (6 h). ✓ keine Lücke.
- **Konsistenz:** `igId`/`permalink`/`mediaType`-Namen einheitlich über Collection/Render/Popup/Ingest. `instagram-posts`-slug konsistent.
- **Phasen-Schnitt:** Phase 1 produziert eigenständig lauffähiges Modul (Dummy-Seed); Phase 2 ergänzt die Live-Daten ohne Phase-1-Änderungen.
