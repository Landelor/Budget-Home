import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken } from "../services/auth.js";

declare module "fastify" {
  interface FastifyRequest {
    user: { id: string; email: string };
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    request.user = { id: payload.sub, email: payload.email };
  } catch {
    return reply.status(401).send({ error: "Invalid or expired access token" });
  }
}
