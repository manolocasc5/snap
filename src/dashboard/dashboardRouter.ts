import { Router, type Request, type Response } from "express";
import { authenticate } from "../auth/authMiddleware.js";
import { db } from "../db/database.js";
import { getUserDashboard } from "./dashboardRepository.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", authenticate, (req: Request, res: Response) => {
  res.status(200).json(getUserDashboard(db, req.user!.id));
});
