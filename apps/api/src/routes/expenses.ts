import type { FastifyInstance } from "fastify";
import { db, expenses } from "@budgetapp/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../middleware/authenticate.js";

type ExpenseFrequency = "fortnightly" | "monthly" | "yearly";

const SUPPORTED_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "INR", "BRL",
  "MXN", "SGD", "HKD", "NOK", "SEK", "DKK", "NZD", "ZAR", "KRW", "TRY",
];

export async function expenseRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/expenses", {
    handler: async (request, reply) => {
      const rows = await db
        .select()
        .from(expenses)
        .where(and(eq(expenses.userId, request.user.id), isNull(expenses.deletedAt)));
      return reply.send(rows);
    },
  });

  app.post<{ Body: { name: string; amount: number; frequency: ExpenseFrequency; currency?: string } }>(
    "/expenses",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "amount", "frequency"],
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            amount: { type: "number", minimum: 0 },
            frequency: { type: "string", enum: ["fortnightly", "monthly", "yearly"] },
            currency: { type: "string", minLength: 3, maxLength: 3, enum: SUPPORTED_CURRENCIES },
          },
        },
      },
      handler: async (request, reply) => {
        const { name, amount, frequency, currency = "USD" } = request.body;
        const [expense] = await db
          .insert(expenses)
          .values({
            userId: request.user.id,
            name,
            amount: amount.toFixed(2),
            currency,
            frequency,
          })
          .returning();
        return reply.status(201).send(expense);
      },
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { name?: string; amount?: number; frequency?: ExpenseFrequency; currency?: string };
  }>("/expenses/:id", {
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
          name: { type: "string", minLength: 1, maxLength: 100 },
          amount: { type: "number", minimum: 0 },
          frequency: { type: "string", enum: ["fortnightly", "monthly", "yearly"] },
          currency: { type: "string", minLength: 3, maxLength: 3, enum: SUPPORTED_CURRENCIES },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const [existing] = await db
        .select()
        .from(expenses)
        .where(and(eq(expenses.id, id), isNull(expenses.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "not_found", message: "Expense not found" });
      }
      if (existing.userId !== request.user.id) {
        return reply.status(403).send({ error: "forbidden", message: "Access denied" });
      }

      const updates: { name?: string; amount?: string; frequency?: ExpenseFrequency; currency?: string } = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.amount !== undefined) updates.amount = body.amount.toFixed(2);
      if (body.frequency !== undefined) updates.frequency = body.frequency;
      if (body.currency !== undefined) updates.currency = body.currency;

      if (Object.keys(updates).length === 0) {
        return reply.send(existing);
      }

      const [updated] = await db
        .update(expenses)
        .set(updates)
        .where(eq(expenses.id, id))
        .returning();

      return reply.send(updated);
    },
  });

  app.delete<{ Params: { id: string } }>("/expenses/:id", {
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
        .from(expenses)
        .where(and(eq(expenses.id, id), isNull(expenses.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "not_found", message: "Expense not found" });
      }
      if (existing.userId !== request.user.id) {
        return reply.status(403).send({ error: "forbidden", message: "Access denied" });
      }

      await db
        .update(expenses)
        .set({ deletedAt: new Date() })
        .where(eq(expenses.id, id));

      return reply.status(204).send();
    },
  });
}
