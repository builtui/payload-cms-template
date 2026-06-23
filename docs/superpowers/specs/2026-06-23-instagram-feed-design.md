# Instagram-Feed — DSGVO-sauberer Social-Stream (Design-Spec)

- **Datum:** 2026-06-23
- **Status:** Design genehmigt (Brainstorming) — Spec-Review ausstehend
- **Scope:** Template-Feature (`payload master`), Erst-Implementierung in Tatiana Liss (`tl.sht.wtf`)

---

## 1. Problem & Ziel

Ein normales Instagram-Embed lädt im **Besucher-Browser** ein Meta-Widget → Cookies/Tracking → Consent nötig. Ohne Zustimmung bleibt der Feed leer. Ziel: Instagram-Beiträge zeigen (Bild/Video + Text + Datum + Link), **ohne** Consent-Gate, in einem CMS-Modul mit Insta-typischer Optik und Klick-Popup.

**Kern-Idee:** Das Embed-Problem umdrehen — Posts **serverseitig** über die Graph API ziehen, Medien **selbst hosten**, und das Modul rein aus *unserer* DB rendern. Im Besucher-Browser läuft nichts von Meta → **kein Consent**. Klicks auf Profilname/Permalink sind simple Outbound-Links (kein Tracker).

## 2. Genehmigte Entscheidungen

| Thema | Entscheidung |
|---|---|
| Datenquelle | **Instagram Graph API** (offiziell, kostenlos). Die alte *Basic Display API* ist seit Dez. 2024 tot. |
| Post-Typen | **Alle**: Bild, Carousel (Mehrbild), Video/Reel. |
| Onboarding | **Eine Agentur-Meta-App + OAuth-„Verbinden"-Button** im Payload-Admin → Ein-Klick pro Kunde. |
| Form | **Template-Feature**, gekapselt; zuerst in Tatiana cms gebaut, dann ins Template promotet. |

## 3. Architektur

Fünf Bausteine: **(A) Agentur-App → (B) Connect-Flow → (C) Token-Store → (D) Sync-Job → (E/F/G) Daten/Modul/Popup.**

### A. Agentur-Meta-App (einmalig, manuell durch die Agentur)
- **Eine** Meta-Developer-App der Agentur. App-ID + App-Secret → Deploy-Config (`.env`), **template-weit gleich** in allen Kundensites.
- **Meta App Review + Business-Verification**: damit die App Instagram-Daten **fremder** Accounts (= Kunden) abfragen darf. Im Dev-Mode geht nur, was eine Rolle in der App hat. → **GATING** für die OAuth-Variante (siehe Risiken).
- Redirect-URIs pro Kundendomain in der App registrieren (z. B. `https://<domain>/api/instagram/callback`).

### B. Connect-Flow (Payload-Admin)
- Admin-Ansicht **„Instagram-Verbindung"** (Global oder Custom-View): Status (`nicht verbunden` / `verbunden als @handle, letzter Sync …`) + **Connect**/**Disconnect**-Button.
- **Connect** → Meta-OAuth-Dialog (Agentur-App-ID, Scopes, Redirect = Site-Callback) → Kunde loggt in *sein* Insta ein + gibt frei.
- **Callback-Route** (`/api/instagram/callback`): tauscht (serverseitig, mit App-Secret) Code → Short-Lived → **Long-Lived-Token** (~60 Tage), ermittelt IG-Business-Account-ID + Handle, speichert in (C).

### C. Token-Speicherung (pro Site)
- Payload-Global **`instagram-connection`**: `igUserId`, `handle`, `accessToken`, `tokenExpiresAt`, `lastSyncedAt`, `lastError`, `connected`.
- **`accessToken` ist Secret** → `access.read: () => false` (nie via REST/Admin ausgegeben) + verschlüsselt (PAYLOAD_SECRET). Niemals über Tools/Logs ausgeben (siehe never-echo-secrets-Linie).

### D. Sync-Job (`scripts/sync-instagram.mjs`, via Cron)
- Liest Token aus (C). Holt die letzten *N* Medien (`image`/`video`/`carousel_album`) mit `caption`, `permalink`, `timestamp`, `media_url`, Carousel-Children.
- **Lädt Medien herunter + hostet selbst** in Payload-Media: Bilder direkt; **Videos durch die bestehende Transcode-Pipeline** (ffmpeg → self-hosted `webm` + Poster, wie der Reels-Block); Carousel → Kind-Bilder. (Instagram-CDN-URLs sind signiert + laufen ab → Hotlinking keine Option.)
- **Upsert** in `instagram-posts` (idempotent über die Insta-`id`).
- **Token-Refresh** wenn nahe Ablauf; bei Fehler/Revoke: `lastError` setzen + Admin-Mail + Admin-UI zeigt „Neu verbinden".
- Cron-Takt: **alle 6 h** (konfigurierbar), wie der DB-Backup-Cron.

### E. Daten — Collection `instagram-posts` (Job-gepflegt)
`igId` (unique) · `permalink` · `caption` · `timestamp` · `mediaType` (image/video/carousel) · `media` (Haupt-Bild/Poster, Media-Rel) · `video` (Media-Rel, bei Video) · `carousel[]` (Media-Rels) · `hidden` (Editor kann Einzelne ausblenden). Im Admin read-only-artig.

### F. Modul — Block `m22-instagram-feed`
- `variant` = **horizontal** (Scroll-Snap-Reihe) | **vertical** (responsives Grid), `count` (Anzahl letzter Posts, Default **8**), optionales Heading.
- Reine **Server-Component** aus `instagram-posts` (gefiltert `!hidden`, neueste `count`). Kein Instagram-Script, kein Cookie. Muster: Reels/MSlider/PortfolioGrid.

### G. Popup (Client-Lightbox, Insta-Optik)
Großes Bild / Carousel-Durchblättern / Video-Playback + Caption + Datum. Klick **Profilname → `instagram.com/<handle>`**, „Auf Instagram ansehen" → `permalink`. Reine Outbound-Links (kein Tracker, kein Consent).

## 4. DSGVO

Alles serverseitig geholt + selbst gehostet → im Besucher-Browser läuft **nichts von Meta** → **kein Consent nötig**. Der OAuth-Connect ist eine **Admin-Aktion des Seitenbetreibers**, kein Besucher-Vorgang (keine Besucherdaten). Rechtlich sauber, da es die **eigenen** Inhalte des Kunden sind.

## 5. Voraussetzungen (Kundenseite, einmalig)
- Instagram als **Business/Creator-Konto** (in den Insta-Settings umstellbar).
- Ggf. **Facebook-Seite** verknüpft — abhängig vom aktuellen Meta-Login-Produkt (siehe Risiken: verifizieren).
- Kunde klickt **einmal „Verbinden"** im Admin. Agentur fügt die Redirect-URI der Domain zur App hinzu.

## 6. Defaults (anpassbar, im Spec-Review änderbar)
- Sync alle **6 h**. · `hidden`-Toggle pro Post: **ja**. · `count`-Default **8**, Job hält die **letzten ~24** Posts vor.

## 7. Risiken & offene Punkte
- ⚠️ **Meta App Review + Business-Verification** ist das **Gating** für die OAuth-Variante: einmalig, bürokratisch, Timeline/Ausgang ungewiss. Launch hängt daran.
- ⚠️ **Meta-API/Permission-Churn** = laufendes Wartungsrisiko (die alte Basic Display API ist tot — das passiert wieder).
- ⚠️ **Bei Implementierung gegen die AKTUELLE Meta-Platform-Doku verifizieren:** exakte Scope-Namen (`instagram_business_basic` o. ä.), ob das aktuelle „Instagram API with Instagram Login"-Produkt eine FB-Seite noch verlangt, App-Review-Checkliste + benötigter Screencast. (Hier bewusst auf Design-Ebene gehalten, keine evtl. veralteten Endpoint-/Scope-Namen festgeschrieben.)
- **Token-Sicherheit:** verschlüsselt in der DB, nie via API/Admin/Logs ausgeben.
- **Video-Storage/Transcode-Last:** bestehende Pipeline wiederverwenden; Storage pro Site beachten.

## 8. Promotion-Pfad
Sauber gekapselt in Tatiana cms bauen (Collection + Global + Callback-Route + Sync-Script + Block + Popup), dann 1:1 ins `payload master`-Template heben. Agentur-App-Config (App-ID/Secret) wird Template-weite Deploy-Vorgabe; pro Kunde bleibt nur der Connect-Klick + Redirect-URI.

## 9. Nicht im Scope (YAGNI)
- Fremde Accounts/Hashtag-Feeds (nur der eigene Account des Kunden).
- Likes/Kommentar-Zahlen, Insights-Dashboards.
- Echtzeit-Webhooks (Cron-Pull reicht).

---

## Anhang A — Meta-App-Setup & App-Review (Agentur-Aufgaben)

*Verifiziert gegen die aktuelle Meta-Doku (2026-06). Produkt: **Instagram API with Instagram Login** — braucht **keine** Facebook-Seite.*

**Zugriffsebenen:** *Standard Access* = nur für einen Account, den die Agentur selbst besitzt (kein Review). **Advanced Access** = Pflicht, sobald **fremde** Accounts (Kunden) verbinden → **App Review + Business-Verification** nötig.

**Benötigte Permission:** nur **`instagram_business_basic`** (Account-Metadaten + Lesen der eigenen Medien). Publishing/Comments/Messages **nicht** anfordern → kleinerer Review-Scope = schnellere Freigabe.

**Token:** Business-Login → Short-Lived (1 h) → Tausch in **Long-Lived (60 Tage)** → vor Ablauf refreshen (Sync-Job).

### Phasen (parallelisierbar)

**Phase 1 — App anlegen (sofort, Dev-Mode, kein Review)**
1. Meta-Business-Account / Business-Manager für undraft (business.facebook.com).
2. developers.facebook.com → *Create App* → **Type „Business"**.
3. Produkt **„Instagram" → „API setup with Instagram login"** hinzufügen.
4. **App-ID + App-Secret** notieren → sicher an mich (1Password `dev`, **nicht** in den Chat).
5. OAuth-**Redirect-URI** je Kundendomain eintragen (z. B. `https://tl.sht.wtf/api/instagram/callback`).
6. Im Dev-Mode: dich/Tatiana als **App-Rolle (Tester)** + ihr Insta als **Business/Creator** → ich baue + teste die ganze Integration gegen den echten Account.

**Phase 2 — Business-Verification (parallel, langsamster Teil → früh starten)**
- Business-Manager → Security Center → **Business Verification**: legaler Firmenname, Adresse, Telefon + Nachweis (Gewerbeanmeldung/Handelsregisterauszug) + Domain/Telefon-Verifikation.

**Phase 3 — App reviewreif machen (vor Einreichung)**
- **Privacy-Policy-URL** (Pflicht, häufigster Ablehnungsgrund) — muss benennen, welche Insta-Daten verarbeitet/gespeichert werden.
- **App-Icon 1024×1024**, App-Kategorie, Business-Email.
- **≥1 erfolgreicher API-Call** mit `instagram_business_basic` (haben wir, sobald die Dev-Integration läuft) — Meta verlangt das vor Review.

**Phase 4 — App Review einreichen**
- App-Dashboard → Instagram → *API setup with Instagram login* → „Complete app review".
- Nur `instagram_business_basic` anfordern; pro Permission Use-Case-Beschreibung (z. B. *„Display the connected business's own recent posts on their own website, fetched server-side and self-hosted — GDPR-compliant, no third-party embed"*).
- **Screencast** des End-to-End-Flows (Admin → Connect → Insta-Login → Freigabe → Feed auf der Website), englische UI / Captions.
- Reviewer-Testanleitung (+ ggf. Test-Login) → **Submit**. Freigabe i. d. R. 2–7 Tage; Ablehnung +3–5 Tage/Runde.

**Phase 5 — Nach Freigabe**
- Advanced Access aktiv → **jeder Kunde** verbindet per Klick. Pro neuer Domain nur die Redirect-URI ergänzen.

### Was ich von dir brauche, um zu bauen
- **App-ID + App-Secret** (sicher; 1Password `dev` als `instagram/meta-app – App Secret`, ich lese via `op` — oder du trägst's selbst in die `.env`).
- Tatianas Insta als **Business/Creator** + dich als **App-Rolle (Tester)**.

**Sequenz:** Phase 1 + 2 **sofort** anstoßen. Ich baue parallel gegen die Dev-App. Build fertig + Business-Verification durch → Phase 4 mit echtem Screencast.

*Quellen: [Instagram API with Instagram Login — Get started](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started/) · [Instagram Platform — App Review](https://developers.facebook.com/docs/instagram-platform/app-review/)*
