import { readFileSync } from "fs";
import { join } from "path";
import type { FastifyInstance } from "fastify";

const VERSION = (() => {
  try {
    return (JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")) as { version?: string }).version ?? "unknown";
  } catch {
    return "unknown";
  }
})();

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/healthz", async (_request, reply) => {
    return reply.status(200).send({ status: "ok", version: VERSION });
  });
}
