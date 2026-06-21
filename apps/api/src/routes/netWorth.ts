import type { FastifyInstance } from "fastify";
import { db, netWorthEntries } from "@budgetapp/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { authenticate } from "../middleware/authenticate.js";

const ASSET_TYPES = ["property", "shares", "bank_account", "super"] as const;
const LIABILITY_TYPES = ["loan"] as const;

type AssetType = (typeof ASSET_TYPES)[number];
type LiabilityType = (typeof LIABILITY_TYPES)[number];
type NetWorthType = AssetType | LiabilityType;

function sectionForType(type: NetWorthType): "asset" | "liability" {
  return (LIABILITY_TYPES as readonly string[]).includes(type) ? "liability" : "asset";
}

export async function netWorthRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/net-worth/entries", {
    handler: async (request, reply) => {
      const rows = await db
        .select()
        .from(netWorthEntries)
        .where(and(eq(netWorthEntries.userId, request.user.id), isNull(netWorthEntries.deletedAt)));
      return reply.send(rows);
    },
  });

  app.post<{ Body: { type: NetWorthType; description: string; amount: number; month: string } }>(
    "/net-worth/entries",
    {
      schema: {
        body: {
          type: "object",
          required: ["type", "description", "amount", "month"],
          additionalProperties: false,
          properties: {
            type: { type: "string", enum: [...ASSET_TYPES, ...LIABILITY_TYPES] },
            description: { type: "string", minLength: 1, maxLength: 255 },
            amount: { type: "number", minimum: 0 },
            month: { type: "string", format: "date" },
          },
        },
      },
      handler: async (request, reply) => {
        const { type, description, amount, month } = request.body;
        const [entry] = await db
          .insert(netWorthEntries)
          .values({
            userId: request.user.id,
            section: sectionForType(type),
            type,
            description,
            amount: amount.toFixed(2),
            month,
          })
          .returning();
        return reply.status(201).send(entry);
      },
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { type?: NetWorthType; description?: string; amount?: number; month?: string };
  }>("/net-worth/entries/:id", {
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
          type: { type: "string", enum: [...ASSET_TYPES, ...LIABILITY_TYPES] },
          description: { type: "string", minLength: 1, maxLength: 255 },
          amount: { type: "number", minimum: 0 },
          month: { type: "string", format: "date" },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const [existing] = await db
        .select()
        .from(netWorthEntries)
        .where(and(eq(netWorthEntries.id, id), isNull(netWorthEntries.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "not_found", message: "Net worth entry not found" });
      }
      if (existing.userId !== request.user.id) {
        return reply.status(403).send({ error: "forbidden", message: "Access denied" });
      }

      const updates: { type?: NetWorthType; section?: "asset" | "liability"; description?: string; amount?: string; month?: string } = {};
      if (body.type !== undefined) {
        updates.type = body.type;
        updates.section = sectionForType(body.type);
      }
      if (body.description !== undefined) updates.description = body.description;
      if (body.amount !== undefined) updates.amount = body.amount.toFixed(2);
      if (body.month !== undefined) updates.month = body.month;

      if (Object.keys(updates).length === 0) {
        return reply.send(existing);
      }

      const [updated] = await db
        .update(netWorthEntries)
        .set(updates)
        .where(eq(netWorthEntries.id, id))
        .returning();

      return reply.send(updated);
    },
  });

  app.delete<{ Params: { id: string } }>("/net-worth/entries/:id", {
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
        .from(netWorthEntries)
        .where(and(eq(netWorthEntries.id, id), isNull(netWorthEntries.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "not_found", message: "Net worth entry not found" });
      }
      if (existing.userId !== request.user.id) {
        return reply.status(403).send({ error: "forbidden", message: "Access denied" });
      }

      await db
        .update(netWorthEntries)
        .set({ deletedAt: new Date() })
        .where(eq(netWorthEntries.id, id));

      return reply.status(204).send();
    },
  });

  // Per-month totals, computed server-side so Assets/Liabilities/Net Position
  // always agree with the stored entries, used to track history month to month.
  app.get("/net-worth/summary", {
    handler: async (request, reply) => {
      const rows = await db
        .select({
          month: netWorthEntries.month,
          totalAssets: sql<string>`COALESCE(SUM(CASE WHEN ${netWorthEntries.section} = 'asset' THEN ${netWorthEntries.amount}::numeric ELSE 0 END), 0)::text`,
          totalLiabilities: sql<string>`COALESCE(SUM(CASE WHEN ${netWorthEntries.section} = 'liability' THEN ${netWorthEntries.amount}::numeric ELSE 0 END), 0)::text`,
        })
        .from(netWorthEntries)
        .where(and(eq(netWorthEntries.userId, request.user.id), isNull(netWorthEntries.deletedAt)))
        .groupBy(netWorthEntries.month)
        .orderBy(netWorthEntries.month);

      const summary = rows.map((row) => ({
        month: row.month,
        totalAssets: row.totalAssets,
        totalLiabilities: row.totalLiabilities,
        netPosition: (parseFloat(row.totalAssets) - parseFloat(row.totalLiabilities)).toFixed(2),
      }));

      return reply.send(summary);
    },
  });
}
