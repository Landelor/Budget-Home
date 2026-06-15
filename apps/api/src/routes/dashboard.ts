import type { FastifyInstance } from "fastify";
import { db, accounts, transactions } from "@budgetapp/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { authenticate } from "../middleware/authenticate.js";

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/dashboard", {
    handler: async (request, reply) => {
      const userId = request.user.id;

      const [balanceRow] = await db
        .select({
          totalBalance: sql<string>`COALESCE(SUM(${accounts.currentBalance}::numeric), 0)::text`,
        })
        .from(accounts)
        .where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt)));

      const [spendRow] = await db
        .select({
          totalSpentThisMonth: sql<string>`COALESCE(SUM(
            CASE WHEN ${transactions.amount}::numeric < 0
              THEN -${transactions.amount}::numeric
              ELSE 0
            END
          ), 0)::text`,
          totalIncomeThisMonth: sql<string>`COALESCE(SUM(
            CASE WHEN ${transactions.amount}::numeric > 0
              THEN ${transactions.amount}::numeric
              ELSE 0
            END
          ), 0)::text`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            isNull(transactions.deletedAt),
            sql`${transactions.date} >= date_trunc('month', CURRENT_DATE)`,
            sql`${transactions.date} <= CURRENT_DATE`,
          ),
        );

      return reply.send({
        totalBalance: balanceRow?.totalBalance ?? "0",
        totalSpentThisMonth: spendRow?.totalSpentThisMonth ?? "0",
        totalIncomeThisMonth: spendRow?.totalIncomeThisMonth ?? "0",
      });
    },
  });
}
