process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection during startup:", err);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});
require("./src/index.js");
