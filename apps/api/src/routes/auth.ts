import type { FastifyInstance } from "fastify";
import { db, users, refreshTokens } from "@budgetapp/db";
import { eq, and, gt } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from "../services/auth.js";

interface RegisterBody {
  email: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface RefreshBody {
  refreshToken: string;
}

interface LogoutBody {
  refreshToken: string;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: RegisterBody }>("/auth/register", {
    schema: {
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8 },
        },
      },
    },
    handler: async (request, reply) => {
      const { email, password } = request.body;

      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existing.length > 0) {
        return reply.status(409).send({ error: "Email already registered" });
      }

      const passwordHash = await hashPassword(password);

      await db.insert(users).values({
        email: email.toLowerCase(),
        passwordHash,
      });

      return reply.status(201).send({ message: "Account created" });
    },
  });

  app.post<{ Body: LoginBody }>("/auth/login", {
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
    schema: {
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string" },
          password: { type: "string" },
        },
      },
    },
    handler: async (request, reply) => {
      const { email, password } = request.body;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      const valid = user ? await verifyPassword(password, user.passwordHash) : false;

      if (!user || !valid) {
        return reply.status(401).send({ error: "Invalid email or password" });
      }

      const accessToken = signAccessToken({ sub: user.id, email: user.email });
      const { rawToken, tokenHash, expiresAt } = generateRefreshToken();

      await db.insert(refreshTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      return reply.status(200).send({ accessToken, refreshToken: rawToken });
    },
  });

  app.post<{ Body: RefreshBody }>("/auth/refresh", {
    schema: {
      body: {
        type: "object",
        required: ["refreshToken"],
        properties: {
          refreshToken: { type: "string" },
        },
      },
    },
    handler: async (request, reply) => {
      const { refreshToken } = request.body;
      const tokenHash = hashRefreshToken(refreshToken);
      const now = new Date();

      const [stored] = await db
        .select()
        .from(refreshTokens)
        .where(
          and(
            eq(refreshTokens.tokenHash, tokenHash),
            gt(refreshTokens.expiresAt, now),
          ),
        )
        .limit(1);

      if (!stored) {
        return reply.status(401).send({ error: "Invalid or expired refresh token" });
      }

      const [user] = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.id, stored.userId))
        .limit(1);

      if (!user) {
        return reply.status(401).send({ error: "User not found" });
      }

      await db
        .delete(refreshTokens)
        .where(eq(refreshTokens.id, stored.id));

      const accessToken = signAccessToken({ sub: user.id, email: user.email });
      const newRefresh = generateRefreshToken();

      await db.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: newRefresh.tokenHash,
        expiresAt: newRefresh.expiresAt,
      });

      return reply
        .status(200)
        .send({ accessToken, refreshToken: newRefresh.rawToken });
    },
  });

  app.post<{ Body: LogoutBody }>("/auth/logout", {
    schema: {
      body: {
        type: "object",
        required: ["refreshToken"],
        properties: {
          refreshToken: { type: "string" },
        },
      },
    },
    handler: async (request, reply) => {
      const { refreshToken } = request.body;
      const tokenHash = hashRefreshToken(refreshToken);

      await db
        .delete(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash));

      return reply.status(204).send();
    },
  });
}
