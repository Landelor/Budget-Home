import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { healthRoutes } from "./routes/health.js";
import { helloRoutes } from "./routes/hello.js";
import { authRoutes } from "./routes/auth.js";
import { accountRoutes } from "./routes/accounts.js";
import { transactionRoutes } from "./routes/transactions.js";
import { categoryRoutes } from "./routes/categories.js";
import { budgetRoutes } from "./routes/budgets.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { settingsRoutes } from "./routes/settings.js";
import { expenseRoutes } from "./routes/expenses.js";
import { exchangeRateRoutes } from "./routes/exchangeRates.js";
import { utilityRoutes } from "./routes/utilities.js";
import { incomeRoutes } from "./routes/income.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env["LOG_LEVEL"] ?? "info",
    },
    bodyLimit: 10 * 1024 * 1024, // 10 MB — supports large CSV imports
  });

  await app.register(cors, {
    origin: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
  });

  await app.register(rateLimit, {
    global: false,
  });

  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  });

  await app.register(healthRoutes);
  await app.register(helloRoutes);
  await app.register(authRoutes);
  await app.register(accountRoutes);
  await app.register(transactionRoutes);
  await app.register(categoryRoutes);
  await app.register(budgetRoutes);
  await app.register(dashboardRoutes);
  await app.register(settingsRoutes);
  await app.register(expenseRoutes);
  await app.register(exchangeRateRoutes);
  await app.register(utilityRoutes);
  await app.register(incomeRoutes);

  return app;
}
