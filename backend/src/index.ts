import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { metricsRouter } from "./routes/metrics";
import { processesRouter } from "./routes/processes";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5000;
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: clientUrl }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: "Backend is running" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api", metricsRouter);
app.use("/api", processesRouter);
app.use("/api", adminRouter);

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
