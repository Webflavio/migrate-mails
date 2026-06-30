const express = require("express");
const accountsRepo = require("../repos/accounts");
const foldersRepo = require("../repos/folders");
const jobsRepo = require("../repos/jobs");
const migrationsRepo = require("../repos/migrations");
const router = express.Router();
router.get("/", (req, res) => {
  const accounts = accountsRepo.listAccounts();
  const migrations = migrationsRepo.listMigrations(20);
  res.render("pages/migrate/index", { title: "Migrate", accounts, migrations });
});
router.get("/new", (req, res) => {
  const accounts = accountsRepo.listAccounts();
  res.render("pages/migrate/form", { title: "New Migration", accounts, sourceFolders: [], error: null });
});
router.get("/folders/:accountId", (req, res) => {
  res.json(foldersRepo.listFolders(Number(req.params.accountId)));
});
router.post("/", (req, res) => {
  const sourceAccountId = Number(req.body.sourceAccountId);
  const targetAccountId = Number(req.body.targetAccountId);
  if (!sourceAccountId || !targetAccountId || sourceAccountId === targetAccountId) {
    return res.render("pages/migrate/form", {
      title: "New Migration",
      accounts: accountsRepo.listAccounts(),
      error: "Select different source and target accounts.",
      sourceFolders: foldersRepo.listFolders(sourceAccountId),
    });
  }
  const folderMapping = {};
  const sourceFolders = foldersRepo.listFolders(sourceAccountId);
  for (const folder of sourceFolders) {
    const key = `map_${folder.id}`;
    if (req.body[key]) folderMapping[folder.remote_name] = req.body[key];
  }
  const migration = migrationsRepo.createMigration({
    sourceAccountId,
    targetAccountId,
    folderMapping,
    duplicateStrategy: req.body.duplicateStrategy || "message_id",
    jobId: null,
  });
  jobsRepo.createJob("migrate", { migrationId: migration.id });
  res.redirect("/migrate");
});
router.get("/:id", (req, res) => {
  const migration = migrationsRepo.getMigration(Number(req.params.id));
  if (!migration) return res.status(404).render("pages/error", { title: "Not Found", message: "Migration not found." });
  res.render("pages/migrate/show", { title: "Migration", migration });
});
module.exports = router;
