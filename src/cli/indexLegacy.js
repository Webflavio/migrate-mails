const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
const { initDb, closeDb } = require("../db");
const jobsRepo = require("../repos/jobs");
async function run() {
  await initDb();
  const accountId = Number(process.argv[2]);
  if (!accountId) {
    console.error("Usage: node src/cli/indexLegacy.js <accountId>");
    process.exit(1);
  }
  const job = await jobsRepo.createJob("index-legacy", { accountId });
  console.log(`Queued legacy index job #${job.id} for account ${accountId}`);
  await closeDb();
}
run().catch((err) => {
  console.error(err);
  process.exit(1);
});
