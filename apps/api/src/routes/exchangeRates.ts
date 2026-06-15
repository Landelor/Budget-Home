import type { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/authenticate.js";
import { getLatestRates } from "../services/exchangeRate.js";

export async function exchangeRateRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/exchange-rates", {
    handler: async (_request, reply) => {
      try {
        const { rates, date } = await getLatestRates();
        return reply.send({ rates, date });
      } catch (err) {
        app.log.error(err, "Failed to fetch exchange rates");
        return reply.status(503).send({
          error: "service_unavailable",
          message: "Exchange rate service temporarily unavailable",
        });
      }
    },
  });
}
