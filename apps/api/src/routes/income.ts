import type { FastifyInstance } from "fastify";
import { db, incomes, incomePersons, incomeAttachments } from "@budgetapp/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../middleware/authenticate.js";
import { randomUUID } from "node:crypto";
import { createWriteStream, createReadStream, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

type IncomeFrequency = "fortnightly" | "monthly" | "yearly";

const SUPPORTED_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "INR", "BRL",
  "MXN", "SGD", "HKD", "NOK", "SEK", "DKK", "NZD", "ZAR", "KRW", "TRY",
];

const UPLOAD_DIR = process.env["UPLOAD_DIR"] ?? join(process.cwd(), "uploads");

function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
}

export async function incomeRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  // --- Income Persons ---

  app.get("/income/persons", {
    handler: async (request, reply) => {
      const rows = await db
        .select()
        .from(incomePersons)
        .where(and(eq(incomePersons.userId, request.user.id), isNull(incomePersons.deletedAt)));
      return reply.send(rows);
    },
  });

  app.post<{ Body: { name: string } }>("/income/persons", {
    schema: {
      body: {
        type: "object",
        required: ["name"],
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
        },
      },
    },
    handler: async (request, reply) => {
      const { name } = request.body;
      const [person] = await db
        .insert(incomePersons)
        .values({ userId: request.user.id, name })
        .returning();
      return reply.status(201).send(person);
    },
  });

  app.patch<{ Params: { id: string }; Body: { name?: string } }>("/income/persons/:id", {
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
          name: { type: "string", minLength: 1, maxLength: 100 },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const [existing] = await db
        .select()
        .from(incomePersons)
        .where(and(eq(incomePersons.id, id), isNull(incomePersons.deletedAt)))
        .limit(1);
      if (!existing) return reply.status(404).send({ error: "not_found", message: "Person not found" });
      if (existing.userId !== request.user.id) return reply.status(403).send({ error: "forbidden" });

      if (!request.body.name) return reply.send(existing);

      const [updated] = await db
        .update(incomePersons)
        .set({ name: request.body.name })
        .where(eq(incomePersons.id, id))
        .returning();
      return reply.send(updated);
    },
  });

  app.delete<{ Params: { id: string } }>("/income/persons/:id", {
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
        .from(incomePersons)
        .where(and(eq(incomePersons.id, id), isNull(incomePersons.deletedAt)))
        .limit(1);
      if (!existing) return reply.status(404).send({ error: "not_found" });
      if (existing.userId !== request.user.id) return reply.status(403).send({ error: "forbidden" });

      await db.update(incomePersons).set({ deletedAt: new Date() }).where(eq(incomePersons.id, id));
      return reply.status(204).send();
    },
  });

  // --- Incomes ---

  app.get("/income", {
    handler: async (request, reply) => {
      const rows = await db
        .select()
        .from(incomes)
        .where(and(eq(incomes.userId, request.user.id), isNull(incomes.deletedAt)));
      return reply.send(rows);
    },
  });

  app.post<{
    Body: { name: string; date: string; amount: number; frequency?: IncomeFrequency; currency?: string; personId?: string };
  }>("/income", {
    schema: {
      body: {
        type: "object",
        required: ["name", "date", "amount"],
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          date: { type: "string", format: "date" },
          amount: { type: "number", minimum: 0 },
          frequency: { type: "string", enum: ["fortnightly", "monthly", "yearly"] },
          currency: { type: "string", minLength: 3, maxLength: 3, enum: SUPPORTED_CURRENCIES },
          personId: { type: "string", format: "uuid" },
        },
      },
    },
    handler: async (request, reply) => {
      const { name, date, amount, frequency = "monthly", currency = "USD", personId } = request.body;

      if (personId) {
        const [person] = await db
          .select()
          .from(incomePersons)
          .where(and(eq(incomePersons.id, personId), eq(incomePersons.userId, request.user.id), isNull(incomePersons.deletedAt)))
          .limit(1);
        if (!person) return reply.status(400).send({ error: "invalid_person", message: "Person not found" });
      }

      const [income] = await db
        .insert(incomes)
        .values({ userId: request.user.id, name, date, amount: amount.toFixed(2), currency, frequency, personId: personId ?? null })
        .returning();
      return reply.status(201).send(income);
    },
  });

  app.patch<{
    Params: { id: string };
    Body: { name?: string; date?: string; amount?: number; frequency?: IncomeFrequency; currency?: string; personId?: string | null };
  }>("/income/:id", {
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
          name: { type: "string", minLength: 1, maxLength: 100 },
          date: { type: "string", format: "date" },
          amount: { type: "number", minimum: 0 },
          frequency: { type: "string", enum: ["fortnightly", "monthly", "yearly"] },
          currency: { type: "string", minLength: 3, maxLength: 3, enum: SUPPORTED_CURRENCIES },
          personId: { type: ["string", "null"] },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const [existing] = await db
        .select()
        .from(incomes)
        .where(and(eq(incomes.id, id), isNull(incomes.deletedAt)))
        .limit(1);
      if (!existing) return reply.status(404).send({ error: "not_found" });
      if (existing.userId !== request.user.id) return reply.status(403).send({ error: "forbidden" });

      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.date !== undefined) updates.date = body.date;
      if (body.amount !== undefined) updates.amount = body.amount.toFixed(2);
      if (body.frequency !== undefined) updates.frequency = body.frequency;
      if (body.currency !== undefined) updates.currency = body.currency;
      if ("personId" in body) updates.personId = body.personId ?? null;

      if (Object.keys(updates).length === 0) return reply.send(existing);

      const [updated] = await db.update(incomes).set(updates).where(eq(incomes.id, id)).returning();
      return reply.send(updated);
    },
  });

  app.delete<{ Params: { id: string } }>("/income/:id", {
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
        .from(incomes)
        .where(and(eq(incomes.id, id), isNull(incomes.deletedAt)))
        .limit(1);
      if (!existing) return reply.status(404).send({ error: "not_found" });
      if (existing.userId !== request.user.id) return reply.status(403).send({ error: "forbidden" });

      await db.update(incomes).set({ deletedAt: new Date() }).where(eq(incomes.id, id));
      return reply.status(204).send();
    },
  });

  // --- Income Attachments ---

  app.get("/income/attachments", {
    handler: async (request, reply) => {
      const rows = await db
        .select()
        .from(incomeAttachments)
        .where(and(eq(incomeAttachments.userId, request.user.id), isNull(incomeAttachments.deletedAt)));
      return reply.send(rows);
    },
  });

  app.get<{ Params: { id: string } }>("/income/:id/attachments", {
    schema: {
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const [income] = await db
        .select()
        .from(incomes)
        .where(and(eq(incomes.id, id), isNull(incomes.deletedAt)))
        .limit(1);
      if (!income) return reply.status(404).send({ error: "not_found" });
      if (income.userId !== request.user.id) return reply.status(403).send({ error: "forbidden" });

      const rows = await db
        .select()
        .from(incomeAttachments)
        .where(and(eq(incomeAttachments.incomeId, id), isNull(incomeAttachments.deletedAt)));
      return reply.send(rows);
    },
  });

  app.post<{ Params: { id: string } }>("/income/:id/attachments", {
    handler: async (request, reply) => {
      const { id } = request.params;
      const [income] = await db
        .select()
        .from(incomes)
        .where(and(eq(incomes.id, id), isNull(incomes.deletedAt)))
        .limit(1);
      if (!income) return reply.status(404).send({ error: "not_found" });
      if (income.userId !== request.user.id) return reply.status(403).send({ error: "forbidden" });

      const [existing] = await db
        .select()
        .from(incomeAttachments)
        .where(and(eq(incomeAttachments.incomeId, id), isNull(incomeAttachments.deletedAt)))
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
        .insert(incomeAttachments)
        .values({
          userId: request.user.id,
          incomeId: id,
          originalName: data.filename,
          storageKey,
          fileSize,
        })
        .returning();

      return reply.status(201).send(attachment);
    },
  });

  app.get<{ Params: { attachmentId: string } }>("/income/attachments/:attachmentId/content", {
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
        .from(incomeAttachments)
        .where(and(eq(incomeAttachments.id, attachmentId), isNull(incomeAttachments.deletedAt)))
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

  app.delete<{ Params: { attachmentId: string } }>("/income/attachments/:attachmentId", {
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
        .from(incomeAttachments)
        .where(and(eq(incomeAttachments.id, attachmentId), isNull(incomeAttachments.deletedAt)))
        .limit(1);
      if (!attachment) return reply.status(404).send({ error: "not_found" });
      if (attachment.userId !== request.user.id) return reply.status(403).send({ error: "forbidden" });

      await db
        .update(incomeAttachments)
        .set({ deletedAt: new Date() })
        .where(eq(incomeAttachments.id, attachmentId));

      const filePath = join(UPLOAD_DIR, attachment.storageKey);
      if (existsSync(filePath)) {
        try { unlinkSync(filePath); } catch { /* ignore cleanup errors */ }
      }

      return reply.status(204).send();
    },
  });
}
