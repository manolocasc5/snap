import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { authRouter } from "./auth/authRouter.js";
import { config } from "./config.js";
import { dashboardRouter } from "./dashboard/dashboardRouter.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { redirectToOriginalUrl, urlsRouter } from "./urls/urlsRouter.js";

export const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(requestLogger);
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/urls", urlsRouter);
app.use("/dashboard", dashboardRouter);
app.get("/:code", redirectToOriginalUrl);

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: "Ruta no encontrada", path: req.originalUrl });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isProduction = process.env.NODE_ENV === "production";
  const body: { error: string; message?: string } = { error: "Error interno del servidor" };

  if (!isProduction && err instanceof Error) {
    body.message = err.message;
  }

  res.status(500).json(body);
}

app.use(notFoundHandler);
app.use(errorHandler);
