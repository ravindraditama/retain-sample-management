# Retain Sample Management System

React + TypeScript + Tailwind frontend · Node.js + Express backend · MySQL 8 database.

## Quick start (development)

```bash
docker compose up -d            # MySQL 8 (or point server/.env at your own MySQL)
npm run setup                   # installs frontend + server dependencies
cp server/.env.example server/.env
npm run server:dev              # API on :4000 — creates the schema and the default admin on first start
npm run dev                     # frontend on :5173 (proxies /api to :4000)
```

The app opens straight to the dashboard — **there is no login** (see the security note below).

## Production

```bash
# set NODE_ENV=production in server/.env
npm run start:prod              # builds the React app + server; Express serves both on PORT
```
Put it behind HTTPS (nginx/Caddy/your platform) and limit access by network.

## Access (no login)
Login, user accounts and the Users page were removed on request. Every visitor has full access: they can import, edit, move, **dispose and delete** records. The audit trail records the actor as `open-access`, so it cannot show *who* did something.
**Restrict who can reach the server** (company network/VPN, firewall or reverse-proxy allow-list). Do not expose it to the public internet.

## Key behaviour
- **Retention** = production date + 13 months, stored as a MySQL generated column (`samples.expiration_date`), so it can never drift. Status (Active / Near Expired ≤30d / Ready for Disposal / Disposed) is computed from today's date at query time.
- **Notifications** are generated at start-up, hourly, and after create/import/edit: one per sample for its current band (30 / 14 / 7 days, due date reached). Samples at the due date appear under *Disposal → Ready for Disposal*.
- **Disposal** records who/when/from where in `disposals`, moves the sample to *Dump Trash* and logs the movement.
- **Movements**: every move (single, bulk, edit form, disposal) writes `sample_movements`; everything also writes `audit_log` in the same transaction.
- **Import**: the file is read in the browser, validated and classified on the server (*New / Already exists / Duplicate in file / Invalid*) and nothing is saved until you confirm. Choose *skip* or *update* for existing records. Header row is auto-detected (the standard template has the title in row 1, headers in row 2).

## Duplicate rule — please read
Your Excel repeats the same 5L Number on different machines/shifts (4,765 unique 5L numbers in 5,466 rows). A strict "unique 5L Number" rule would reject ~13% of your real data, so the default is
`DUPLICATE_MODE=five_l_machine_shift` (unique per 5L + Machine + Shift). Set `DUPLICATE_MODE=five_l` for strict 5L uniqueness. Choose before the first import; changing it later requires recomputing `samples.dup_key`.

## Tests
`cd server && npm test` — import parsing, date handling, retention maths and duplicate classification.
