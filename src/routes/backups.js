const express = require("express");
const backupRunsRepo = require("../repos/backupRuns");
const router = express.Router();
router.get("/", (req, res) => {
  res.render("pages/backups/index", { title: "Backups", runs: backupRunsRepo.listRuns(null, 100) });
});
module.exports = router;
