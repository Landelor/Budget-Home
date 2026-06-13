import type { FastifyInstance } from "fastify";

export async function helloRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (_request, _reply) => {
    return { message: "BudgetApp API", version: "0.0.1" };
  });
}
