import type { FastifyInstance } from "fastify";
import { db, budgets, transactions } from "@budgetapp/db";
import { eq, and, isNull, gte, sql } from "drizzle-orm";
import { authenticate } from "../middleware/authenticate.js";

type BudgetPeriod = "monthly" | "weekly";

export async function budgetRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/budgets", {
    handler: async (request, reply) => {
      const userId = request.user.id;

      const rows = await db
        .select({
          id: budgets.id,
          userId: budgets.userId,
          categoryId: budgets.categoryId,
          period: budgets.period,
          limitAmount: budgets.limitAmount,
          startDate: budgets.startDate,
          createdAt: budgets.createdAt,
          currentSpend: sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)::text`,
        })
        .from(budgets)
        .leftJoin(
          transactions,
          and(
            eq(transactions.categoryId, budgets.categoryId),
            eq(transactions.userId, userId),
            isNull(transactions.deletedAt),
            gte(transactions.date, budgets.startDate),
            sql`${transactions.date} < CASE
              WHEN ${budgets.period} = 'monthly' THEN (${budgets.startDate}::date + INTERVAL '1 month')::text
              ELSE (${budgets.startDate}::date + INTERVAL '7 days')::text
            END`,
          ),
        )
        .where(and(eq(budgets.userId, userId), isNull(budgets.deletedAt)))
        .groupBy(
          budgets.id,
          budgets.userId,
          budgets.categoryId,
          budgets.period,
          budgets.limitAmount,
          budgets.startDate,
          budgets.createdAt,
        );

      return reply.send(rows);
    },
  });

  app.post<{
    Body: {
      categoryId: string;
      period: BudgetPeriod;
      limitAmount: number;
      startDate: string;
    };
  }>("/budgets", {
    schema: {
      body: {
        type: "object",
        required: ["categoryId", "period", "limitAmount", "startDate"],
        additionalProperties: false,
        properties: {
          categoryId: { type: "string", format: "uuid" },
          period: { type: "string", enum: ["monthly", "weekly"] },
          limitAmount: { type: "number", minimum: 0 },
          startDate: { type: "string" },
        },
      },
    },
    handler: async (request, reply) => {
      const { categoryId, period, limitAmount, startDate } = request.body;

      const [budget] = await db
        .insert(budgets)
        .values({
          userId: request.user.id,
          categoryId,
          period,
          limitAmount: limitAmount.toFixed(2),
          startDate,
        })
        .returning();

      return reply.status(201).send(budget);
    },
  });

  app.patch<{
    Params: { id: string };
    Body: { limitAmount?: number };
  }>("/budgets/:id", {
    schema: {
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          limitAmount: { type: "number", minimum: 0 },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const [existing] = await db
        .select()
        .from(budgets)
        .where(and(eq(budgets.id, id), isNull(budgets.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "not_found", message: "Budget not found" });
      }
      if (existing.userId !== request.user.id) {
        return reply.status(403).send({ error: "forbidden", message: "Access denied" });
      }

      if (body.limitAmount === undefined) {
        return reply.send(existing);
      }

      const [updated] = await db
        .update(budgets)
        .set({ limitAmount: body.limitAmount.toFixed(2) })
        .where(eq(budgets.id, id))
        .returning();

      return reply.send(updated);
    },
  });

  app.delete<{ Params: { id: string } }>("/budgets/:id", {
    schema: {
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;

      const [existing] = await db
        .select()
        .from(budgets)
        .where(and(eq(budgets.id, id), isNull(budgets.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "not_found", message: "Budget not found" });
      }
      if (existing.userId !== request.user.id) {
        return reply.status(403).send({ error: "forbidden", message: "Access denied" });
      }

      await db
        .update(budgets)
        .set({ deletedAt: new Date() })
        .where(eq(budgets.id, id));

      return reply.status(204).send();
    },
  });
}
