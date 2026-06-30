# MailVault — Email Backup Manager

Node.js web app for backing up, browsing, exporting, and migrating IMAP email accounts with a multi-account dashboard backed by SQLite.

## Features

- **Multiple accounts** — add, edit, test, and delete IMAP mailboxes
- **Backup** — fetch all folders incrementally; raw `.eml` files + searchable metadata in SQLite
- **Browse** — search/filter by account, folder, date, attachments, and keywords
- **Export** — download backups as EML ZIP or MBOX
- **Migrate** — push backed-up messages to another IMAP account with folder mapping and duplicate skipping
- **Legacy import** — index existing `.eml` files from the `backup/` folder

## Requirements

- Node.js 18+
- npm

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
DB_PATH=./data/app.db
STORAGE_PATH=./storage/emails
EXPORT_PATH=./exports
LEGACY_BACKUP_PATH=./backup
MAX_MESSAGE_MB=50
EXPORT_RETENTION_DAYS=7
IMAP_TIMEOUT_MS=120000
```

**Important:** set `APP_SECRET` to a long random string before adding accounts. Passwords are encrypted in SQLite using this key.

Set `ADMIN_PASSWORD` in `.env` to protect the dashboard — all pages require sign-in.

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

## Project Structure

```
src/
  index.js          Express app entry
  config.js         Environment config
  db/               SQLite schema and init
  lib/              IMAP, crypto, parser, storage helpers
  repos/            Database repositories
  services/         Backup, export, migrate, job runner
  routes/           HTTP routes
  views/            EJS templates
storage/emails/     Raw .eml message files
exports/            Generated export files
data/app.db         SQLite database
```

## Jobs

Backup, export, migrate, and legacy-index operations run as background jobs. View progress under **Jobs**.

## Security Notes

- Run locally; do not expose to the public internet without authentication.
- Keep `.env` and `data/app.db` private.
- Account passwords are AES-256-GCM encrypted at rest.
