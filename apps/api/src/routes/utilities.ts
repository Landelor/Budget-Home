import type { FastifyInstance } from "fastify";
import { db, utilities } from "@budgetapp/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../middleware/authenticate.js";

type UtilityType = "gas" | "power" | "water";

const SUPPORTED_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "INR", "BRL",
  "MXN", "SGD", "HKD", "NOK", "SEK", "DKK", "NZD", "ZAR", "KRW", "TRY",
];

export async function utilityRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/utilities", {
    handler: async (request, reply) => {
      const rows = await db
        .select()
        .from(utilities)
        .where(and(eq(utilities.userId, request.user.id), isNull(utilities.deletedAt)));
      return reply.send(rows);
    },
  });

  app.post<{ Body: { type: UtilityType; date: string; amount: number; serviceDays: number; currency?: string } }>(
    "/utilities",
    {
      schema: {
        body: {
          type: "object",
          required: ["type", "date", "amount", "serviceDays"],
          additionalProperties: false,
          properties: {
            type: { type: "string", enum: ["gas", "power", "water"] },
            date: { type: "string", format: "date" },
            amount: { type: "number", minimum: 0 },
            serviceDays: { type: "integer", minimum: 1 },
            currency: { type: "string", minLength: 3, maxLength: 3, enum: SUPPORTED_CURRENCIES },
          },
        },
      },
      handler: async (request, reply) => {
        const { type, date, amount, serviceDays, currency = "USD" } = request.body;
        const [utility] = await db
          .insert(utilities)
          .values({
            userId: request.user.id,
            type,
            date,
            amount: amount.toFixed(2),
            currency,
            serviceDays,
          })
          .returning();
        return reply.status(201).send(utility);
      },
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { date?: string; amount?: number; serviceDays?: number; currency?: string };
  }>("/utilities/:id", {
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
          date: { type: "string", format: "date" },
          amount: { type: "number", minimum: 0 },
          serviceDays: { type: "integer", minimum: 1 },
          currency: { type: "string", minLength: 3, maxLength: 3, enum: SUPPORTED_CURRENCIES },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const [existing] = await db
        .select()
        .from(utilities)
        .where(and(eq(utilities.id, id), isNull(utilities.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "not_found", message: "Utility not found" });
      }
      if (existing.userId !== request.user.id) {
        return reply.status(403).send({ error: "forbidden", message: "Access denied" });
      }

      const updates: { date?: string; amount?: string; serviceDays?: number; currency?: string } = {};
      if (body.date !== undefined) updates.date = body.date;
      if (body.amount !== undefined) updates.amount = body.amount.toFixed(2);
      if (body.serviceDays !== undefined) updates.serviceDays = body.serviceDays;
      if (body.currency !== undefined) updates.currency = body.currency;

      if (Object.keys(updates).length === 0) {
        return reply.send(existing);
      }

      const [updated] = await db
        .update(utilities)
        .set(updates)
        .where(eq(utilities.id, id))
        .returning();

      return reply.send(updated);
    },
  });

  app.delete<{ Params: { id: string } }>("/utilities/:id", {
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
        .from(utilities)
        .where(and(eq(utilities.id, id), isNull(utilities.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "not_found", message: "Utility not found" });
      }
      if (existing.userId !== request.user.id) {
        return reply.status(403).send({ error: "forbidden", message: "Access denied" });
      }

      await db
        .update(utilities)
        .set({ deletedAt: new Date() })
        .where(eq(utilities.id, id));

      return reply.status(204).send();
    },
  });
}
