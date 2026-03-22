import express from "express";

import apiRoutes from "./routes/index.js";

const app = express();

app.use(express.json());
app.use("/api", apiRoutes);

app.use((err, _req, res, _next) => {
  const status = err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(status).json({ message });
});

export default app;
