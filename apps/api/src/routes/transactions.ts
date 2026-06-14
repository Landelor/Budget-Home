import type { FastifyInstance } from "fastify";
import { db, transactions, accounts } from "@budgetapp/db";
import { eq, and, isNull, gte, lte, desc, sql } from "drizzle-orm";
import { authenticate } from "../middleware/authenticate.js";

export async function transactionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get<{
    Querystring: {
      accountId?: string;
      categoryId?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    };
  }>("/transactions", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          accountId: { type: "string", format: "uuid" },
          categoryId: { type: "string", format: "uuid" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          page: { type: "integer", minimum: 1, default: 1 },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
        },
      },
    },
    handler: async (request, reply) => {
      const { accountId, categoryId, startDate, endDate, page = 1, limit = 50 } =
        request.query;
      const offset = (page - 1) * limit;

      const rows = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, request.user.id),
            isNull(transactions.deletedAt),
            accountId ? eq(transactions.accountId, accountId) : undefined,
            categoryId ? eq(transactions.categoryId, categoryId) : undefined,
            startDate ? gte(transactions.date, startDate) : undefined,
            endDate ? lte(transactions.date, endDate) : undefined,
          ),
        )
        .orderBy(desc(transactions.date), desc(transactions.createdAt))
        .limit(limit)
        .offset(offset);

      return reply.send({ data: rows, page, limit });
    },
  });

  app.post<{
    Body: {
      accountId: string;
      amount: number;
      date: string;
      description: string;
      categoryId?: string;
      isRecurring?: boolean;
    };
  }>("/transactions", {
    schema: {
      body: {
        type: "object",
        required: ["accountId", "amount", "date", "description"],
        additionalProperties: false,
        properties: {
          accountId: { type: "string", format: "uuid" },
          amount: { type: "number" },
          date: { type: "string" },
          description: { type: "string", minLength: 1, maxLength: 255 },
          categoryId: { type: "string", format: "uuid" },
          isRecurring: { type: "boolean" },
        },
      },
    },
    handler: async (request, reply) => {
      const { accountId, amount, date, description, categoryId, isRecurring = false } =
        request.body;

      const [account] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)))
        .limit(1);

      if (!account) {
        return reply
          .status(404)
          .send({ error: "not_found", message: "Account not found", field: "accountId" });
      }
      if (account.userId !== request.user.id) {
        return reply.status(403).send({ error: "forbidden", message: "Access denied" });
      }

      const amountStr = amount.toFixed(2);

      const [tx] = await db
        .insert(transactions)
        .values({
          accountId,
          userId: request.user.id,
          amount: amountStr,
          date,
          description,
          categoryId,
          isRecurring,
        })
        .returning();

      await db
        .update(accounts)
        .set({
          currentBalance: sql`${accounts.currentBalance}::numeric + ${amountStr}::numeric`,
        })
        .where(eq(accounts.id, accountId));

      return reply.status(201).send(tx);
    },
  });

  app.patch<{
    Params: { id: string };
    Body: {
      description?: string;
      categoryId?: string | null;
      date?: string;
      amount?: number;
    };
  }>("/transactions/:id", {
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
          description: { type: "string", minLength: 1, maxLength: 255 },
          categoryId: { type: ["string", "null"], format: "uuid" },
          date: { type: "string" },
          amount: { type: "number" },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const [existing] = await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "not_found", message: "Transaction not found" });
      }
      if (existing.userId !== request.user.id) {
        return reply.status(403).send({ error: "forbidden", message: "Access denied" });
      }

      const updates: {
        description?: string;
        categoryId?: string | null;
        date?: string;
        amount?: string;
      } = {};

      if (body.description !== undefined) updates.description = body.description;
      if (body.categoryId !== undefined) updates.categoryId = body.categoryId;
      if (body.date !== undefined) updates.date = body.date;
      if (body.amount !== undefined) updates.amount = body.amount.toFixed(2);

      if (Object.keys(updates).length === 0) {
        return reply.send(existing);
      }

      const [updated] = await db
        .update(transactions)
        .set(updates)
        .where(eq(transactions.id, id))
        .returning();

      if (updates.amount !== undefined) {
        const delta = (body.amount! - parseFloat(existing.amount)).toFixed(2);
        await db
          .update(accounts)
          .set({
            currentBalance: sql`${accounts.currentBalance}::numeric + ${delta}::numeric`,
          })
          .where(eq(accounts.id, existing.accountId));
      }

      return reply.send(updated);
    },
  });

  app.post<{
    Body: {
      accountId: string;
      transactions: Array<{
        date: string;
        description: string;
        amount: number;
      }>;
    };
  }>("/transactions/import", {
    schema: {
      body: {
        type: "object",
        required: ["accountId", "transactions"],
        additionalProperties: false,
        properties: {
          accountId: { type: "string", format: "uuid" },
          transactions: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["date", "description", "amount"],
              additionalProperties: false,
              properties: {
                date: { type: "string" },
                description: { type: "string", minLength: 1, maxLength: 255 },
                amount: { type: "number" },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { accountId, transactions: rows } = request.body;

      const [account] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)))
        .limit(1);

      if (!account) {
        return reply
          .status(404)
          .send({ error: "not_found", message: "Account not found", field: "accountId" });
      }
      if (account.userId !== request.user.id) {
        return reply.status(403).send({ error: "forbidden", message: "Access denied" });
      }

      const values = rows.map((row) => ({
        accountId,
        userId: request.user.id,
        amount: row.amount.toFixed(2),
        date: row.date,
        description: row.description.slice(0, 255),
        isRecurring: false as const,
      }));

      await db.insert(transactions).values(values);

      const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);
      await db
        .update(accounts)
        .set({
          currentBalance: sql`${accounts.currentBalance}::numeric + ${totalAmount.toFixed(2)}::numeric`,
        })
        .where(eq(accounts.id, accountId));

      return reply.status(201).send({ imported: rows.length });
    },
  });

  app.delete<{ Params: { id: string } }>("/transactions/:id", {
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
        .from(transactions)
        .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "not_found", message: "Transaction not found" });
      }
      if (existing.userId !== request.user.id) {
        return reply.status(403).send({ error: "forbidden", message: "Access denied" });
      }

      await db
        .update(transactions)
        .set({ deletedAt: new Date() })
        .where(eq(transactions.id, id));

      const reversal = (-parseFloat(existing.amount)).toFixed(2);
      await db
        .update(accounts)
        .set({
          currentBalance: sql`${accounts.currentBalance}::numeric + ${reversal}::numeric`,
        })
        .where(eq(accounts.id, existing.accountId));

      return reply.status(204).send();
    },
  });
}
