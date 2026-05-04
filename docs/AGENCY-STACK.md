# Agency Stack — Hosting, CDN, Mail, Storage

Pragmatischer Stack für Agenturen, die mehrere Kunden-Sites auf Basis dieses
Templates betreiben wollen — mit klarer Pro-Kunde-Trennung (Billing,
Operations, Migration-Pfad bei Vertragsende).

Geschrieben aus den Boothside-Erfahrungen (Hetzner + Bunny + PM2 als
gelaufene Konfiguration). Email-Empfehlungen sind das offene Stück, das in
2026 noch durchprobiert wird — die Optionen sind dokumentiert, der Stack
selbst ist provider-agnostisch.

---

## Übersicht

| Layer | Empfehlung | Pro-Kunde-Trennung | Größenordnung |
|---|---|---|---|
| Compute | **Hetzner Cloud** (CX22 / CCX13) | eigene VPS pro Kunde | €5–15 / Monat |
| CDN / Static Edge | **Bunny.net** | Pull-Zone pro Domain, Billing-Group | ~€0.005 / GB EU-Traffic |
| Object Storage (Media) | **Bunny Storage** *oder* **Hetzner Storage Box** | Bucket / Sub-Account pro Kunde | Bunny ~€0.01/GB · Hetzner €4 / 100 GB |
| Transactional Mail | **Maileroo** (oder Postmark — siehe unten) | Domain / Server pro Kunde, eigene API-Keys | Maileroo ~$5 / 10k · Postmark $15 / 10k pro Server |
| Marketing Mail | **CleverReach** (bestehender Agency-Account) | Sub-Accounts | nach CleverReach-Plan |
| DNS | **Cloudflare** *oder* Hetzner DNS | bleibt beim Kunden | Cloudflare gratis |
| Backups | **Hetzner Cloud Backups** + DB-Cron auf S3-kompatibel | per VPS | +20% auf VPS-Preis |

**Trennungsprinzip**: DNS bleibt beim Kunden (Postmark/Bunny brauchen nur
DKIM/SPF + CNAME-Records). Hosting + CDN + Storage + Mail laufen alle in
deiner Agency-Konten-Struktur — Kunde bekommt eine monatliche Rechnung von
dir, du hast operative Hoheit. Bei Kündigung: DNS-Records werden umgezogen,
keine Lock-in-Sorgen.

---

## Compute — Hetzner Cloud

Der etablierte Pfad für dieses Template — siehe [DEPLOYMENT.md](DEPLOYMENT.md)
für Setup-Details. Pro Kunde eine VPS, deploy via `scripts/deploy.sh`
(siehe [LEARNINGS.md §11.1](LEARNINGS.md#111-nextjs-16-webpack-pinnen-turbopack-prod-ist-instabil)
für die Webpack-Pinning-Rationale).

**Größen-Faustregel**:
- **CX22** (€5/mo, 4 GB RAM, Shared CPU) — kleine Kundenseite, wenig Traffic, OK mit Swap für Build.
- **CCX13** (€15/mo, 8 GB RAM, Dedicated CPU) — größere Builds (50+ Pages, viele Blocks), Live-Preview ohne Lag, Build runs in &lt;5 min.

**Wann CX22 nicht reicht**: Build OOMs trotz `--max-old-space-size=8000` →
auf CCX13 hoch oder lokal bauen + via rsync ausrollen.

---

## CDN — Bunny.net

Bunny hat das Pro-Kunde-Trennungsmodell, das dieser Stack braucht: ein
Account, beliebig viele Pull-Zones, **Billing-Groups** zum getrennten Tracken
von Kosten pro Kunde.

**Setup pro Kunde**:
1. Pull-Zone anlegen (Origin = `https://kunde.de` oder direkt der Hetzner-IP)
2. CNAME `cdn.kunde.de` → `<pull-zone>.b-cdn.net` in Kunden-DNS
3. Custom Hostname in Bunny verifizieren + SSL automatisch ausstellen
4. `NEXT_PUBLIC_MEDIA_CDN_URL=https://cdn.kunde.de` in Server-`.env`
5. Pull-Zone in eigene Billing-Group hängen (für getrennte Rechnungen)

**Cache-Invalidation** nach Media-Re-Processing: siehe
[LEARNINGS.md §11.7](LEARNINGS.md#117-direct-cdn-payloadimage-skip-nextjs-image-optimizer)
und [DEPLOYMENT.md — CDN-Cache](DEPLOYMENT.md#cdn-cache-invalidation-nach-re-processing).

**Image-Optimizer** ($9.50/mo pro Pull-Zone) ist optional — für die meisten
Sites reichen die pre-generated Sharp-Varianten + edge-Delivery. Ab
Bandwidth-Engpass dazu schalten.

---

## Object Storage — Media

Wenn Sites über ~5 GB Media gehen oder du häufige redeploys ohne Filesystem-
Verlust willst, wandert die Media-Library in Object-Storage.

### Option A: Bunny Storage
- **Pro**: Eine Provider-Beziehung (Bunny CDN + Storage). Direkte Edge-
  Delivery ohne Origin-Pull.
- **Contra**: Kein S3-API → braucht eigenen Payload-Adapter (oder Bunny's
  FTP-Sync).

### Option B: Hetzner Object Storage / Storage Box
- **Pro**: Neue Hetzner-Object-Storage (S3-kompatibel) → `@payloadcms/storage-s3`
  funktioniert out-of-the-box. EU-only.
- **Contra**: Falls Storage Box statt Object Storage: kein direkter HTTP-
  Access, braucht Sync auf VPS.

**Empfehlung für Bundle-Standard**: Hetzner Object Storage (S3-API) mit
`@payloadcms/storage-s3`-Adapter. Ein Bucket pro Kunde, deren Bunny-Pull-Zone
zeigt auf den Bucket. Sauberste Trennung + niemand muss VPS-Filesystem
managen.

---

## Transactional Mail

**Was hier zählt**: Kontaktformular-Submissions, Password-Reset, Order-
Confirmations etc. — kein Newsletter (das macht CleverReach). Die zwei
Anforderungen für ein Agentur-Setup:

1. **EU-Datenresidenz** — Kunden-Kontaktdaten dürfen nicht in die US.
2. **Pro-Kunde-Trennung** — getrennte API-Keys, getrennte Reputations-Räume
   (sonst wäscht ein blockierter Kunde die Reputation für alle anderen mit).

Zwei Provider, die das sauber abdecken — die Wahl hängt am Trade-off
*Pricing/Free-Tier-Großzügigkeit* vs. *Track-Record-Premium*:

### Option A: Maileroo *(empfohlen für Test-Run, Stand 2026)*

**Setup-Modell**: Ein Maileroo-Account für die Agency, beliebig viele
Domains anlegen, jede Domain hat ihren **eigenen Sending-Key** —
funktional die Trennung, die hier gebraucht wird.

| | Wert |
|---|---|
| Server-Standort | Deutschland + Niederlande (EU) |
| Headquarter | Melbourne, Australien |
| Free-Tier | 3 000 Mails/Monat, 3 Domains, **inkl. dedizierter IP** |
| Pricing-Beispiel | 25k Mails / Monat ≈ $10 |
| Pro Domain | eigener API-Key, eigenes Monitoring-Dashboard |
| Webhooks | delivery / bounce / open / click |
| Multi-User | ja (Team-Collaboration) |
| Sub-Account-Billing | nein — alles in einem Account konsolidiert |

**Stärken**: Pricing-Differenz ist substanziell (5 Kunden × 10k Mails ≈ $10
bei Maileroo vs. $75 bei Postmark). Free dedizierte IP auf allen Plans ist
ungewöhnlich. EU-Server + GDPR-Statement explizit.

**Schwächen / Risiken**:
- **IP-Reputation**: Maileroo ist ein junger Provider (~2022/2023). Postmark
  hat 10+ Jahre Reputation als Spam-Filter-friendly Sender. Bei
  geschäftskritischen Mails (Order-Confirmations für E-Commerce, Auth-Resets
  für SaaS) ist das ein realer Faktor.
- **Konsolidiertes Billing**: Eine Rechnung für alle Kunden — du fakturierst
  weiter, kein per-Kunde-Invoice von Maileroo.
- **Headquarter Australien** kann bei *sehr* risikoaversen
  Datenschutzbeauftragten Schrems-II-Diskussionen auslösen, obwohl die Daten
  in EU bleiben.
- **Hourly Sending-Limits** wurden in Reviews erwähnt — relevant bei Bursts
  (Newsletter-Send oder Massen-Notifications), nicht bei normalen
  Form-Submissions.

**Wann es passt**:
- Kleinere bis mittlere Kundenseiten (Boothside-Größenordnung).
- Du fakturierst Mail als Pauschale weiter (Trennung in Abrechnung egal).
- Du hast Bandbreite, die Deliverability über 4-6 Wochen zu beobachten.

### Option B: Postmark — Premium-Track-Record

**Setup-Modell**: Ein Postmark-Account, **ein "Server" pro Kunde** — jeder
Server hat eigene API-Keys, eigene Logs, eigenes Bounce-Handling, eigene
Templates.

| | Wert |
|---|---|
| Server-Standort | EU-Region verfügbar (`api.postmarkapp.eu`) |
| Headquarter | USA (ActiveCampaign-Tochter) |
| Free-Tier | 100 Mails/Monat (auf einem Server) |
| Pricing | $15/Server/Monat für 10k Mails |
| Pro Kunde | ein Server = eigene API-Keys, Logs, Templates, Reputation |
| Webhooks | delivery / bounce / open / click + Inbound + Spam-Complaints |
| Sub-Account-Billing | über "Account Owners"-Setup separierbar |
| Message-Streams | transactional vs. broadcast auf separaten IPs |

**Stärken**: 10+ Jahre Top-Tier-Deliverability (~98.7% Inbox-Placement in
2025-Tests). Sie werfen aktiv Marketing-Sender raus → IP-Reputation bleibt
sauber. Pro-Server-Trennung ist die granularste Architektur am Markt.

**Schwächen**: Pricing skaliert linear nach Kunden ($15 × N). Free-Tier
faktisch nur für Testen. Headquarter US — DKIM/SPF + EU-Region kompensiert
das technisch, juristisch ist es ein Argument das du gewinnen musst.

**Wann es passt**:
- Geschäftskritische Mails (E-Commerce, Auth, Healthcare).
- Enterprise-Kunden, die "Premium-Provider" als Trust-Signal wollen.
- Du willst per-Kunde-Billing/Logs auch im Mail-Provider sehen, nicht nur
  in deiner internen Rechnung.

### Andere Optionen — kurz warum nicht Default

- **Mailgun EU**: Funktioniert, "domains" als Trennachse. Pricing pro Mail
  (gut bei stark schwankendem Volumen, schwer zu forecasten). Kein klarer
  Vorteil gegenüber Maileroo.
- **Brevo / Mailjet**: Primär Marketing-Provider mit Transactional als
  Add-on. Überlappen mit CleverReach → "wer macht jetzt was"-Verwirrung.
  *Wenn du CleverReach langfristig ablösen willst*, dann Brevo
  in Erwägung ziehen — aber dann auch fürs Marketing.
- **AWS SES**: Billigster pro Mail bei Skala, aber Setup-Overhead pro Kunde
  (eigenes IP-Warmup, eigene Bounce-Handling-Pipeline). Macht Sinn ab
  ~500k Mails/Monat über alle Kunden zusammen, vorher nicht den Einsatz wert.
- **Resend**: Schöne DX, aber kein klares Sub-Account-Konzept. Single-Tenant.

---

## Payload-Integration

Email-Adapter wird in `payload.config.ts` registriert. Beide Provider
funktionieren über `@payloadcms/email-nodemailer` mit dem jeweiligen
Nodemailer-Transport.

### Maileroo via SMTP

```bash
pnpm add @payloadcms/email-nodemailer nodemailer
```

```ts
// payload.config.ts
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import nodemailer from 'nodemailer'

export default buildConfig({
  // …
  email: nodemailerAdapter({
    defaultFromAddress: process.env.EMAIL_FROM_ADDRESS!,
    defaultFromName: process.env.EMAIL_FROM_NAME!,
    transport: nodemailer.createTransport({
      host: 'smtp.maileroo.com',
      port: 587,
      auth: {
        user: process.env.MAILEROO_USER!,        // typisch die Versand-Domain
        pass: process.env.MAILEROO_API_KEY!,     // pro Domain ein eigener Key
      },
    }),
  }),
})
```

### Postmark

```bash
pnpm add @payloadcms/email-nodemailer nodemailer-postmark-transport
```

```ts
// payload.config.ts
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import postmarkTransport from 'nodemailer-postmark-transport'

export default buildConfig({
  email: nodemailerAdapter({
    defaultFromAddress: process.env.EMAIL_FROM_ADDRESS!,
    defaultFromName: process.env.EMAIL_FROM_NAME!,
    transport: postmarkTransport({
      auth: { apiKey: process.env.POSTMARK_API_KEY! },
    }),
  }),
})
```

### `.env` pro Kunde

```bash
EMAIL_FROM_ADDRESS=noreply@kunde.de
EMAIL_FROM_NAME="Kunde GmbH"

# Maileroo
MAILEROO_USER=kunde.de
MAILEROO_API_KEY=mr_…

# ODER Postmark
POSTMARK_API_KEY=…
```

### DNS-Records (pro Kunden-Domain)

Für beide Provider:
- **DKIM**-CNAME oder TXT (Provider liefert die Records nach Domain-
  Verifikation)
- **SPF**-TXT mit `include:` für den Provider
- **DMARC**-TXT (mindestens `v=DMARC1; p=none; rua=mailto:postmaster@kunde.de`)

Kunde fügt die Records in seine DNS-Zone ein, Provider verifiziert.

---

## Operations-Pattern

### Neuer Kunde aufsetzen — Reihenfolge

1. **VPS** in Hetzner Cloud Console anlegen (CX22 default)
2. **Bunny Pull-Zone** anlegen, in Billing-Group des Kunden hängen
3. **Object-Storage Bucket** anlegen (Hetzner S3 oder Bunny Storage)
4. **Mail-Domain** im gewählten Provider anlegen (Maileroo: Domain hinzufügen
   und Sending-Key kopieren · Postmark: Server anlegen und Server-Token
   kopieren)
5. **DNS-Records** an den Kunden geben (DKIM/SPF/DMARC + CNAME für CDN +
   A/AAAA für Site) — Kunde setzt sie selbst in seinem DNS-Provider
6. **VPS-Setup** via [DEPLOYMENT.md](DEPLOYMENT.md) Schritt 1-12
7. **`.env` schreiben** mit `EMAIL_*`, `NEXT_PUBLIC_MEDIA_CDN_URL`, etc.
8. **Initial-Deploy** + Smoke-Test gegen Public-Domain

### Kunde geht — sauberer Exit

1. DNS-Records umziehen (Kunde übernimmt Hosting-Provider seiner Wahl)
2. Final-Backup auf S3-kompatibel ziehen (DB-Dump + Media-Bucket-Sync)
3. VPS löschen (Hetzner)
4. Bunny Pull-Zone + Storage-Bucket löschen
5. Mail-Domain im Provider löschen (Sending-Key wird ungültig)
6. Letzte Rechnung pro-rata abschließen

Keine Datenresten in deinen Systemen, keine offene API-Keys, keine
Blockade weil Kunde vergessen hat irgendwas zu kündigen.

### Cost-per-Kunde Beispielrechnung (Boothside-Größenordnung)

| Posten | Kosten/Monat |
|---|---|
| Hetzner CX22 + Backups | €6 |
| Bunny CDN (~50 GB Traffic, EU) | €0.25 |
| Hetzner Object Storage (~10 GB Media) | ~€0.50 |
| Mail (~500 Form-Submissions/Monat) | $0 (Maileroo Free) bzw. $15 (Postmark Server) |
| **Summe** | **€7–22 / Monat** |

Brutto-Marge nach Weiter-Verrechnung an den Kunden: *deine Sache*.

---

## Verwandte Docs

- [DEPLOYMENT.md](DEPLOYMENT.md) — Server-Setup-Schritte (Hetzner-spezifisch)
- [LEARNINGS.md §11](LEARNINGS.md#11-boothside-2026--neue-erkenntnisse) —
  Webpack-Pinning, Direct-CDN-Pattern, deploy.sh
- [LEARNINGS.md §12](LEARNINGS.md#12-module-bau-übersetzbarkeit-tracking--prinzipien)
  — Block-Bau- & Translation-Prinzipien
- [FORM-BUILDER-SPEC.md](FORM-BUILDER-SPEC.md) — Spec für ein zukünftiges
  Form-Builder-Feature (Powermail-Äquivalent für Payload)

---

## Diese Doc pflegen

Wenn ein Provider-Wechsel passiert (z.B. Maileroo wird durch eigene
Mailcow-Instanz ersetzt) oder ein Erfahrungswert sich ändert
(Deliverability-Drift, Pricing-Reform): hier nachtragen + Datum + kurzen
Grund. Die Konkurrenz-Vergleiche darunter NICHT löschen — andere
Sessions/Projekte profitieren von dem dokumentierten Trade-off-Raum.
