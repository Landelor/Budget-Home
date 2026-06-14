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
        .select({ defaultCurrency: users.defaultCurrency })
        .from(users)
        .where(eq(users.id, request.user.id))
        .limit(1);

      if (!user) {
        return reply.status(404).send({ error: "not_found", message: "User not found" });
      }

      return reply.send({ defaultCurrency: user.defaultCurrency });
    },
  });

  app.patch<{ Body: { defaultCurrency: string } }>("/settings", {
    schema: {
      body: {
        type: "object",
        required: ["defaultCurrency"],
        additionalProperties: false,
        properties: {
          defaultCurrency: {
            type: "string",
            minLength: 3,
            maxLength: 3,
            enum: SUPPORTED_CURRENCIES,
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { defaultCurrency } = request.body;

      const [updated] = await db
        .update(users)
        .set({ defaultCurrency })
        .where(eq(users.id, request.user.id))
        .returning({ defaultCurrency: users.defaultCurrency });

      if (!updated) {
        return reply.status(404).send({ error: "not_found", message: "User not found" });
      }

      return reply.send({ defaultCurrency: updated.defaultCurrency });
    },
  });
}
