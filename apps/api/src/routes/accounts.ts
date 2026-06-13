import type { FastifyInstance } from "fastify";
import { db, accounts } from "@budgetapp/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../middleware/authenticate.js";

type AccountType = "checking" | "savings" | "credit" | "cash";

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/accounts", {
    handler: async (request, reply) => {
      const rows = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.userId, request.user.id), isNull(accounts.deletedAt)));
      return reply.send(rows);
    },
  });

  app.post<{ Body: { name: string; type: AccountType; currency?: string; initialBalance?: number } }>(
    "/accounts",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "type"],
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            type: { type: "string", enum: ["checking", "savings", "credit", "cash"] },
            currency: { type: "string", minLength: 3, maxLength: 3 },
            initialBalance: { type: "number" },
          },
        },
      },
      handler: async (request, reply) => {
        const { name, type, currency = "USD", initialBalance = 0 } = request.body;
        const [account] = await db
          .insert(accounts)
          .values({
            userId: request.user.id,
            name,
            type,
            currency,
            currentBalance: initialBalance.toFixed(2),
          })
          .returning();
        return reply.status(201).send(account);
      },
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { name?: string; type?: AccountType };
  }>("/accounts/:id", {
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
          type: { type: "string", enum: ["checking", "savings", "credit", "cash"] },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const [existing] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, id), isNull(accounts.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "not_found", message: "Account not found" });
      }
      if (existing.userId !== request.user.id) {
        return reply.status(403).send({ error: "forbidden", message: "Access denied" });
      }

      const updates: { name?: string; type?: AccountType } = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.type !== undefined) updates.type = body.type;

      if (Object.keys(updates).length === 0) {
        return reply.send(existing);
      }

      const [updated] = await db
        .update(accounts)
        .set(updates)
        .where(eq(accounts.id, id))
        .returning();

      return reply.send(updated);
    },
  });

  app.delete<{ Params: { id: string } }>("/accounts/:id", {
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
        .from(accounts)
        .where(and(eq(accounts.id, id), isNull(accounts.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "not_found", message: "Account not found" });
      }
      if (existing.userId !== request.user.id) {
        return reply.status(403).send({ error: "forbidden", message: "Access denied" });
      }

      await db
        .update(accounts)
        .set({ deletedAt: new Date() })
        .where(eq(accounts.id, id));

      return reply.status(204).send();
    },
  });
}
