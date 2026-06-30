function errorHandler(err, req, res, next) {
  if (err.name !== "ValidationError" || !String(err.message || "").includes("X-Forwarded-For")) {
    console.error(err);
  }
  if (req.headers.accept && req.headers.accept.includes("json")) {
    return res.status(500).json({ error: err.message });
  }
  res.status(500).render("pages/error", { title: "Error", message: err.message });
}
module.exports = errorHandler;
