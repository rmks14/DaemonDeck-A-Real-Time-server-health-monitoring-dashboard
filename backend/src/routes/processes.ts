import { Router } from "express";
import { requireRole } from "../middleware/auth";
import { getProcesses, restartProcess } from "../services/processes";

export const processesRouter = Router();

processesRouter.get("/processes", async (req, res) => {
  if (!requireRole(req, res, ["viewer", "operator", "admin"])) {
    return;
  }

  res.json({ processes: await getProcesses() });
});

processesRouter.post("/processes/:id/restart", (req, res) => {
  const session = requireRole(req, res, ["operator", "admin"]);

  if (!session) {
    return;
  }

  const processRecord = restartProcess(req.params.id, session.user.username);

  if (!processRecord) {
    res.status(404).json({ message: "Process was not found." });
    return;
  }

  res.json({
    message: `${processRecord.name} restarted.`,
    process: processRecord,
  });
});
