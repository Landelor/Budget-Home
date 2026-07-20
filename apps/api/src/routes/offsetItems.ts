import type { FastifyInstance } from "fastify";
import { db, offsetItems, expenses } from "@budgetapp/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../middleware/authenticate.js";

export async function offsetItemRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/offset-items", {
    handler: async (request, reply) => {
      const rows = await db
        .select()
        .from(offsetItems)
        .where(and(eq(offsetItems.userId, request.user.id), isNull(offsetItems.deletedAt)));
      return reply.send(rows);
    },
  });

  app.post<{ Body: { expenseId: string } }>("/offset-items", {
    schema: {
      body: {
        type: "object",
        required: ["expenseId"],
        additionalProperties: false,
        properties: {
          expenseId: { type: "string", format: "uuid" },
        },
      },
    },
    handler: async (request, reply) => {
      const { expenseId } = request.body;

      const [expense] = await db
        .select()
        .from(expenses)
        .where(and(eq(expenses.id, expenseId), isNull(expenses.deletedAt)))
        .limit(1);

      if (!expense || expense.userId !== request.user.id) {
        return reply.status(404).send({ error: "not_found", message: "Expense not found" });
      }

      const [item] = await db
        .insert(offsetItems)
        .values({ userId: request.user.id, expenseId })
        .returning();
      return reply.status(201).send(item);
    },
  });

  app.delete<{ Params: { id: string } }>("/offset-items/:id", {
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
        .from(offsetItems)
        .where(and(eq(offsetItems.id, id), isNull(offsetItems.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "not_found", message: "Offset item not found" });
      }
      if (existing.userId !== request.user.id) {
        return reply.status(403).send({ error: "forbidden", message: "Access denied" });
      }

      await db
        .update(offsetItems)
        .set({ deletedAt: new Date() })
        .where(eq(offsetItems.id, id));

      return reply.status(204).send();
    },
  });
}
