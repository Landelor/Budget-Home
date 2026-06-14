import type { FastifyInstance } from "fastify";
import { db, users } from "@budgetapp/db";
import { eq } from "drizzle-orm";
import { authenticate } from "../middleware/authenticate.js";

const SUPPORTED_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "INR", "BRL",
  "MXN", "SGD", "HKD", "NOK", "SEK", "DKK", "NZD", "ZAR", "KRW", "TRY",
];

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/settings", {
    handler: async (request, reply) => {
      const [user] = await db
        .select({ defaultCurrency: users.defaultCurrency, darkMode: users.darkMode })
        .from(users)
        .where(eq(users.id, request.user.id))
        .limit(1);

      if (!user) {
        return reply.status(404).send({ error: "not_found", message: "User not found" });
      }

      return reply.send({ defaultCurrency: user.defaultCurrency, darkMode: user.darkMode });
    },
  });

  app.patch<{ Body: { defaultCurrency?: string; darkMode?: boolean } }>("/settings", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          defaultCurrency: {
            type: "string",
            minLength: 3,
            maxLength: 3,
            enum: SUPPORTED_CURRENCIES,
          },
          darkMode: {
            type: "boolean",
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { defaultCurrency, darkMode } = request.body;

      const updates: Record<string, unknown> = {};
      if (defaultCurrency !== undefined) updates.defaultCurrency = defaultCurrency;
      if (darkMode !== undefined) updates.darkMode = darkMode;

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ error: "bad_request", message: "No fields to update" });
      }

      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, request.user.id))
        .returning({ defaultCurrency: users.defaultCurrency, darkMode: users.darkMode });

      if (!updated) {
        return reply.status(404).send({ error: "not_found", message: "User not found" });
      }

      return reply.send({ defaultCurrency: updated.defaultCurrency, darkMode: updated.darkMode });
    },
  });
}
