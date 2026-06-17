import type { FastifyInstance } from "fastify";
import { db, utilities, utilityAttachments } from "@budgetapp/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../middleware/authenticate.js";
import { randomUUID } from "node:crypto";
import { createWriteStream, createReadStream, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

const UPLOAD_DIR = process.env["UPLOAD_DIR"] ?? join(process.cwd(), "uploads");

function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
}

type UtilityType = "gas" | "power" | "water";

const SUPPORTED_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "INR", "BRL",
  "MXN", "SGD", "HKD", "NOK", "SEK", "DKK", "NZD", "ZAR", "KRW", "TRY",
];

export async function utilityRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/utilities", {
    handler: async (request, reply) => {
      const rows = await db
        .select()
        .from(utilities)
        .where(and(eq(utilities.userId, request.user.id), isNull(utilities.deletedAt)));
      return reply.send(rows);
    },
  });

  app.post<{ Body: { type: UtilityType; date: string; amount: number; serviceDays: number; currency?: string } }>(
    "/utilities",
    {
      schema: {
        body: {
          type: "object",
          required: ["type", "date", "amount", "serviceDays"],
          additionalProperties: false,
          properties: {
            type: { type: "string", enum: ["gas", "power", "water"] },
            date: { type: "string", format: "date" },
            amount: { type: "number", minimum: 0 },
            serviceDays: { type: "integer", minimum: 1 },
            currency: { type: "string", minLength: 3, maxLength: 3, enum: SUPPORTED_CURRENCIES },
          },
        },
      },
      handler: async (request, reply) => {
        const { type, date, amount, serviceDays, currency = "USD" } = request.body;
        const [utility] = await db
          .insert(utilities)
          .values({
            userId: request.user.id,
            type,
            date,
            amount: amount.toFixed(2),
            currency,
            serviceDays,
          })
          .returning();
        return reply.status(201).send(utility);
      },
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { date?: string; amount?: number; serviceDays?: number; currency?: string };
  }>("/utilities/:id", {
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
          date: { type: "string", format: "date" },
          amount: { type: "number", minimum: 0 },
          serviceDays: { type: "integer", minimum: 1 },
          currency: { type: "string", minLength: 3, maxLength: 3, enum: SUPPORTED_CURRENCIES },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const [existing] = await db
        .select()
        .from(utilities)
        .where(and(eq(utilities.id, id), isNull(utilities.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "not_found", message: "Utility not found" });
      }
      if (existing.userId !== request.user.id) {
        return reply.status(403).send({ error: "forbidden", message: "Access denied" });
      }

      const updates: { date?: string; amount?: string; serviceDays?: number; currency?: string } = {};
      if (body.date !== undefined) updates.date = body.date;
      if (body.amount !== undefined) updates.amount = body.amount.toFixed(2);
      if (body.serviceDays !== undefined) updates.serviceDays = body.serviceDays;
      if (body.currency !== undefined) updates.currency = body.currency;

      if (Object.keys(updates).length === 0) {
        return reply.send(existing);
      }

      const [updated] = await db
        .update(utilities)
        .set(updates)
        .where(eq(utilities.id, id))
        .returning();

      return reply.send(updated);
    },
  });

  app.delete<{ Params: { id: string } }>("/utilities/:id", {
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
        .from(utilities)
        .where(and(eq(utilities.id, id), isNull(utilities.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "not_found", message: "Utility not found" });
      }
      if (existing.userId !== request.user.id) {
        return reply.status(403).send({ error: "forbidden", message: "Access denied" });
      }

      await db
        .update(utilities)
        .set({ deletedAt: new Date() })
        .where(eq(utilities.id, id));

      return reply.status(204).send();
    },
  });

  // --- Utility Attachments ---

  app.get("/utilities/attachments", {
    handler: async (request, reply) => {
      const rows = await db
        .select()
        .from(utilityAttachments)
        .where(and(eq(utilityAttachments.userId, request.user.id), isNull(utilityAttachments.deletedAt)));
      return reply.send(rows);
    },
  });

  app.get<{ Params: { id: string } }>("/utilities/:id/attachments", {
    schema: {
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const [utility] = await db
        .select()
        .from(utilities)
        .where(and(eq(utilities.id, id), isNull(utilities.deletedAt)))
        .limit(1);
      if (!utility) return reply.status(404).send({ error: "not_found" });
      if (utility.userId !== request.user.id) return reply.status(403).send({ error: "forbidden" });

      const rows = await db
        .select()
        .from(utilityAttachments)
        .where(and(eq(utilityAttachments.utilityId, id), isNull(utilityAttachments.deletedAt)));
      return reply.send(rows);
    },
  });

  app.post<{ Params: { id: string } }>("/utilities/:id/attachments", {
    handler: async (request, reply) => {
      const { id } = request.params;
      const [utility] = await db
        .select()
        .from(utilities)
        .where(and(eq(utilities.id, id), isNull(utilities.deletedAt)))
        .limit(1);
      if (!utility) return reply.status(404).send({ error: "not_found" });
      if (utility.userId !== request.user.id) return reply.status(403).send({ error: "forbidden" });

      const [existing] = await db
        .select()
        .from(utilityAttachments)
        .where(and(eq(utilityAttachments.utilityId, id), isNull(utilityAttachments.deletedAt)))
        .limit(1);
      if (existing) {
        const data = await request.file();
        data?.file.resume();
        return reply.status(409).send({ error: "already_exists", message: "An attachment already exists for this entry. Delete it first." });
      }

      const data = await request.file();
      if (!data) return reply.status(400).send({ error: "no_file", message: "No file uploaded" });

      if (data.mimetype !== "application/pdf") {
        data.file.resume();
        return reply.status(400).send({ error: "invalid_type", message: "Only PDF files are allowed" });
      }

      ensureUploadDir();
      const storageKey = `${randomUUID()}.pdf`;
      const dest = join(UPLOAD_DIR, storageKey);

      let fileSize = 0;
      const writeStream = createWriteStream(dest);
      data.file.on("data", (chunk: Buffer) => { fileSize += chunk.length; });
      await pipeline(data.file, writeStream);

      const [attachment] = await db
        .insert(utilityAttachments)
        .values({
          userId: request.user.id,
          utilityId: id,
          originalName: data.filename,
          storageKey,
          fileSize,
        })
        .returning();

      return reply.status(201).send(attachment);
    },
  });

  app.get<{ Params: { attachmentId: string } }>("/utilities/attachments/:attachmentId/content", {
    schema: {
      params: {
        type: "object",
        required: ["attachmentId"],
        properties: { attachmentId: { type: "string", format: "uuid" } },
      },
    },
    handler: async (request, reply) => {
      const { attachmentId } = request.params;
      const [attachment] = await db
        .select()
        .from(utilityAttachments)
        .where(and(eq(utilityAttachments.id, attachmentId), isNull(utilityAttachments.deletedAt)))
        .limit(1);
      if (!attachment) return reply.status(404).send({ error: "not_found" });
      if (attachment.userId !== request.user.id) return reply.status(403).send({ error: "forbidden" });

      const filePath = join(UPLOAD_DIR, attachment.storageKey);
      if (!existsSync(filePath)) return reply.status(404).send({ error: "file_missing" });

      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `inline; filename="${attachment.originalName}"`)
        .send(createReadStream(filePath));
    },
  });

  app.delete<{ Params: { attachmentId: string } }>("/utilities/attachments/:attachmentId", {
    schema: {
      params: {
        type: "object",
        required: ["attachmentId"],
        properties: { attachmentId: { type: "string", format: "uuid" } },
      },
    },
    handler: async (request, reply) => {
      const { attachmentId } = request.params;
      const [attachment] = await db
        .select()
        .from(utilityAttachments)
        .where(and(eq(utilityAttachments.id, attachmentId), isNull(utilityAttachments.deletedAt)))
        .limit(1);
      if (!attachment) return reply.status(404).send({ error: "not_found" });
      if (attachment.userId !== request.user.id) return reply.status(403).send({ error: "forbidden" });

      await db
        .update(utilityAttachments)
        .set({ deletedAt: new Date() })
        .where(eq(utilityAttachments.id, attachmentId));

      const filePath = join(UPLOAD_DIR, attachment.storageKey);
      if (existsSync(filePath)) {
        try { unlinkSync(filePath); } catch { /* ignore cleanup errors */ }
      }

      return reply.status(204).send();
    },
  });
}
