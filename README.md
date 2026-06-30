# MailVault — Email Backup Manager

Node.js web app for backing up, browsing, exporting, and migrating IMAP email accounts with a multi-account dashboard backed by MySQL.

## Features

- **Multiple accounts** — add, edit, test, and delete IMAP mailboxes
- **Backup** — fetch all folders incrementally; raw `.eml` files + searchable metadata in MySQL
- **Browse** — search/filter by account, folder, date, attachments, and keywords
- **Export** — download backups as EML ZIP or MBOX
- **Migrate** — push backed-up messages to another IMAP account with folder mapping and duplicate skipping
- **Legacy import** — index existing `.eml` files from the `backup/` folder

## Requirements

- Node.js 18+ (tested on 18.20.x; Hostinger shared hosting)
- npm
- MySQL 5.7+ or MariaDB 10.3+ (Hostinger includes this)

## Setup

```powershell
cd G:\emails\backup
npm install
```

Copy or edit `.env`:

```env
PORT=3847
APP_SECRET=change-me-to-a-long-random-secret
ADMIN_PASSWORD=your-dashboard-password
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your-mysql-password
MYSQL_DATABASE=mailvault
STORAGE_PATH=./storage/emails
EXPORT_PATH=./exports
LEGACY_BACKUP_PATH=./backup
MAX_MESSAGE_MB=50
EXPORT_RETENTION_DAYS=7
IMAP_TIMEOUT_MS=120000
IMAP_TLS_INSECURE=false
TRUST_PROXY=1
```

Create the MySQL database before first run:

```sql
CREATE DATABASE mailvault CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Tables are created automatically on startup.

**Important:** set `APP_SECRET` to a long random string before adding accounts. Passwords are encrypted in MySQL using this key.

Set `ADMIN_PASSWORD` in `.env` to protect the dashboard — all pages require sign-in.

On Hostinger or any reverse-proxy host, keep `TRUST_PROXY=1` (default). If IMAP tests fail with certificate errors, set `IMAP_TLS_INSECURE=true`.

## Hostinger Deployment

1. In hPanel → **Databases → MySQL**, create a database and user. Note the host, database name, username, and password.
2. In hPanel → **Websites → Node.js**, set:
   - **Application startup file:** `server.js`
   - **Node.js version:** 18.x
   - **Run script:** `npm start`
3. Add environment variables in hPanel (do **not** set `PORT` — Hostinger assigns it automatically):
   - `APP_SECRET`, `ADMIN_PASSWORD`, `TRUST_PROXY=1`
   - `MYSQL_HOST=localhost` (important: use `localhost`, **not** `127.0.0.1` on Hostinger)
   - `MYSQL_PORT=3306`
   - `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
4. After deploy, open **Runtime logs** in hPanel if you see 503 — look for `[startup]` messages.
5. Health check URL: `https://your-domain/health` should return `{"ok":true}`.

If you use a `.env` file on the server, remove `PORT=3847` from it so Hostinger's assigned port is used.

This app uses the pure JavaScript `mysql` driver (no native compilation), so it installs cleanly on Hostinger shared hosting without `node-gyp` or `make`.

### Data persistence (important)

Hostinger redeploys replace the `nodejs/` app folder. Email files and exports are stored in a **persistent folder outside the app**:

```
/home/you/domains/your-site.com/mailvault-data/
  emails/
  exports/
```

MySQL data lives in Hostinger's managed MySQL server (not in the app folder).

To use a custom location for files, set in hPanel:

```env
DATA_DIR=/home/u871337011/domains/your-site.com/mailvault-data
```

Or set absolute paths:

```env
STORAGE_PATH=/home/u871337011/domains/your-site.com/mailvault-data/emails
EXPORT_PATH=/home/u871337011/domains/your-site.com/mailvault-data/exports
```

**Keep `APP_SECRET` the same across redeploys** — if it changes, saved account passwords cannot be decrypted.

## Run

```powershell
npm start
```

Open **http://localhost:3847**

Development with auto-reload:

```powershell
npm run dev
```

## Quick Start

1. Open **Accounts → Add Account** and enter IMAP host, username, and password.
2. Click **Test Connection** on the account page.
3. Click **Run Backup** to fetch mail from the server.
4. If you already have `.eml` files in `backup/`, click **Index Legacy Backup** instead.
5. Use **Browse** to search and read backed-up messages.
6. Use **Export** for EML ZIP or MBOX downloads.
7. Use **Migrate** to copy backups into a new IMAP account.

## CLI

Index legacy backup folder for an account:

```powershell
npm run index-legacy -- 1
```

## Tests

```powershell
npm test
```

Repository tests require a local MySQL server; they skip automatically if MySQL is unavailable.

## Project Structure

```
src/
  index.js          Express app entry
  config.js         Environment config
  db/               MySQL schema and init
  lib/              IMAP, crypto, parser, storage helpers
  repos/            Database repositories
  services/         Backup, export, migrate, job runner
  routes/           HTTP routes
  views/            EJS templates
storage/emails/     Raw .eml message files
exports/            Generated export files
```

## Jobs

Backup, export, migrate, and legacy-index operations run as background jobs. View progress under **Jobs**.

## Security Notes

- Run locally; do not expose to the public internet without authentication.
- Keep `.env` private and restrict MySQL user permissions.
- Account passwords are AES-256-GCM encrypted at rest.
