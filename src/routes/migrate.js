const express = require("express");
const accountsRepo = require("../repos/accounts");
const foldersRepo = require("../repos/folders");
const jobsRepo = require("../repos/jobs");
const migrationsRepo = require("../repos/migrations");
const asyncHandler = require("../middleware/asyncHandler");
const router = express.Router();
router.get("/", asyncHandler(async (req, res) => {
  const accounts = await accountsRepo.listAccounts();
  const migrations = await migrationsRepo.listMigrations(20);
  res.render("pages/migrate/index", { title: "Migrate", accounts, migrations });
}));
router.get("/new", asyncHandler(async (req, res) => {
  const accounts = await accountsRepo.listAccounts();
  res.render("pages/migrate/form", { title: "New Migration", accounts, sourceFolders: [], error: null });
}));
router.get("/folders/:accountId", asyncHandler(async (req, res) => {
  res.json(await foldersRepo.listFolders(Number(req.params.accountId)));
}));
router.post("/", asyncHandler(async (req, res) => {
  const sourceAccountId = Number(req.body.sourceAccountId);
  const targetAccountId = Number(req.body.targetAccountId);
  if (!sourceAccountId || !targetAccountId || sourceAccountId === targetAccountId) {
    return res.render("pages/migrate/form", {
      title: "New Migration",
      accounts: await accountsRepo.listAccounts(),
      error: "Select different source and target accounts.",
      sourceFolders: await foldersRepo.listFolders(sourceAccountId),
    });
  }
  const folderMapping = {};
  const sourceFolders = await foldersRepo.listFolders(sourceAccountId);
  for (const folder of sourceFolders) {
    const key = `map_${folder.id}`;
    if (req.body[key]) folderMapping[folder.remote_name] = req.body[key];
  }
  const migration = await migrationsRepo.createMigration({
    sourceAccountId,
    targetAccountId,
    folderMapping,
    duplicateStrategy: req.body.duplicateStrategy || "message_id",
    jobId: null,
  });
  await jobsRepo.createJob("migrate", { migrationId: migration.id });
  res.redirect("/migrate");
}));
router.get("/:id", asyncHandler(async (req, res) => {
  const migration = await migrationsRepo.getMigration(Number(req.params.id));
  if (!migration) return res.status(404).render("pages/error", { title: "Not Found", message: "Migration not found." });
  res.render("pages/migrate/show", { title: "Migration", migration });
}));
module.exports = router;
