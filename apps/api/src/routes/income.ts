import type { FastifyInstance } from "fastify";
import { db, incomes, incomePersons } from "@budgetapp/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../middleware/authenticate.js";

type IncomeFrequency = "fortnightly" | "monthly" | "yearly";

const SUPPORTED_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "INR", "BRL",
  "MXN", "SGD", "HKD", "NOK", "SEK", "DKK", "NZD", "ZAR", "KRW", "TRY",
];

export async function incomeRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  // --- Income Persons ---

  app.get("/income/persons", {
    handler: async (request, reply) => {
      const rows = await db
        .select()
        .from(incomePersons)
        .where(and(eq(incomePersons.userId, request.user.id), isNull(incomePersons.deletedAt)));
      return reply.send(rows);
    },
  });

  app.post<{ Body: { name: string } }>("/income/persons", {
    schema: {
      body: {
        type: "object",
        required: ["name"],
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
        },
      },
    },
    handler: async (request, reply) => {
      const { name } = request.body;
      const [person] = await db
        .insert(incomePersons)
        .values({ userId: request.user.id, name })
        .returning();
      return reply.status(201).send(person);
    },
  });

  app.patch<{ Params: { id: string }; Body: { name?: string } }>("/income/persons/:id", {
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
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const [existing] = await db
        .select()
        .from(incomePersons)
        .where(and(eq(incomePersons.id, id), isNull(incomePersons.deletedAt)))
        .limit(1);
      if (!existing) return reply.status(404).send({ error: "not_found", message: "Person not found" });
      if (existing.userId !== request.user.id) return reply.status(403).send({ error: "forbidden" });

      if (!request.body.name) return reply.send(existing);

      const [updated] = await db
        .update(incomePersons)
        .set({ name: request.body.name })
        .where(eq(incomePersons.id, id))
        .returning();
      return reply.send(updated);
    },
  });

  app.delete<{ Params: { id: string } }>("/income/persons/:id", {
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
        .from(incomePersons)
        .where(and(eq(incomePersons.id, id), isNull(incomePersons.deletedAt)))
        .limit(1);
      if (!existing) return reply.status(404).send({ error: "not_found" });
      if (existing.userId !== request.user.id) return reply.status(403).send({ error: "forbidden" });

      await db.update(incomePersons).set({ deletedAt: new Date() }).where(eq(incomePersons.id, id));
      return reply.status(204).send();
    },
  });

  // --- Incomes ---

  app.get("/income", {
    handler: async (request, reply) => {
      const rows = await db
        .select()
        .from(incomes)
        .where(and(eq(incomes.userId, request.user.id), isNull(incomes.deletedAt)));
      return reply.send(rows);
    },
  });

  app.post<{
    Body: { name: string; amount: number; frequency: IncomeFrequency; currency?: string; personId?: string };
  }>("/income", {
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
          personId: { type: "string", format: "uuid" },
        },
      },
    },
    handler: async (request, reply) => {
      const { name, amount, frequency, currency = "USD", personId } = request.body;

      if (personId) {
        const [person] = await db
          .select()
          .from(incomePersons)
          .where(and(eq(incomePersons.id, personId), eq(incomePersons.userId, request.user.id), isNull(incomePersons.deletedAt)))
          .limit(1);
        if (!person) return reply.status(400).send({ error: "invalid_person", message: "Person not found" });
      }

      const [income] = await db
        .insert(incomes)
        .values({ userId: request.user.id, name, amount: amount.toFixed(2), currency, frequency, personId: personId ?? null })
        .returning();
      return reply.status(201).send(income);
    },
  });

  app.patch<{
    Params: { id: string };
    Body: { name?: string; amount?: number; frequency?: IncomeFrequency; currency?: string; personId?: string | null };
  }>("/income/:id", {
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
          personId: { type: ["string", "null"] },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const [existing] = await db
        .select()
        .from(incomes)
        .where(and(eq(incomes.id, id), isNull(incomes.deletedAt)))
        .limit(1);
      if (!existing) return reply.status(404).send({ error: "not_found" });
      if (existing.userId !== request.user.id) return reply.status(403).send({ error: "forbidden" });

      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.amount !== undefined) updates.amount = body.amount.toFixed(2);
      if (body.frequency !== undefined) updates.frequency = body.frequency;
      if (body.currency !== undefined) updates.currency = body.currency;
      if ("personId" in body) updates.personId = body.personId ?? null;

      if (Object.keys(updates).length === 0) return reply.send(existing);

      const [updated] = await db.update(incomes).set(updates).where(eq(incomes.id, id)).returning();
      return reply.send(updated);
    },
  });

  app.delete<{ Params: { id: string } }>("/income/:id", {
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
        .from(incomes)
        .where(and(eq(incomes.id, id), isNull(incomes.deletedAt)))
        .limit(1);
      if (!existing) return reply.status(404).send({ error: "not_found" });
      if (existing.userId !== request.user.id) return reply.status(403).send({ error: "forbidden" });

      await db.update(incomes).set({ deletedAt: new Date() }).where(eq(incomes.id, id));
      return reply.status(204).send();
    },
  });
}
