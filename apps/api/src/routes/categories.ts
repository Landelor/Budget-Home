import type { FastifyInstance } from "fastify";
import { db, categories } from "@budgetapp/db";
import { eq, or, isNull } from "drizzle-orm";
import { authenticate } from "../middleware/authenticate.js";

export async function categoryRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/categories", {
    handler: async (request, reply) => {
      const rows = await db
        .select()
        .from(categories)
        .where(or(isNull(categories.userId), eq(categories.userId, request.user.id)));
      return reply.send(rows);
    },
  });

  app.post<{
    Body: {
      name: string;
      color: string;
      icon: string;
      parentCategoryId?: string;
    };
  }>("/categories", {
    schema: {
      body: {
        type: "object",
        required: ["name", "color", "icon"],
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
          icon: { type: "string", minLength: 1, maxLength: 50 },
          parentCategoryId: { type: "string", format: "uuid" },
        },
      },
    },
    handler: async (request, reply) => {
      const { name, color, icon, parentCategoryId } = request.body;

      const [category] = await db
        .insert(categories)
        .values({
          userId: request.user.id,
          name,
          color,
          icon,
          parentCategoryId,
        })
        .returning();

      return reply.status(201).send(category);
    },
  });
}
