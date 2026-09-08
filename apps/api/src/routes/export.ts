import type { FastifyInstance } from "fastify";
import {
  db,
  accounts,
  transactions,
  categories,
  budgets,
  expenses,
  incomePersons,
  incomes,
  utilities,
  netWorthEntries,
  offsetItems,
} from "@budgetapp/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../middleware/authenticate.js";
import { toCsv } from "../services/csv.js";
import { createZip } from "../services/zip.js";

interface ExportQuery {
  format?: "csv" | "json";
}

// Fetch every exportable entity for a user in one go. Soft-deleted rows and
// internal-only columns (userId, attachment storage keys, etc.) are excluded.
async function collectExportData(userId: string) {
  const [
    accountRows,
    transactionRows,
    categoryRows,
    budgetRows,
    expenseRows,
    incomePersonRows,
    incomeRows,
    utilityRows,
    netWorthRows,
    offsetItemRows,
  ] = await Promise.all([
    db.select().from(accounts).where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt))),
    db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt))),
    db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId)),
    db.select().from(budgets).where(and(eq(budgets.userId, userId), isNull(budgets.deletedAt))),
    db.select().from(expenses).where(and(eq(expenses.userId, userId), isNull(expenses.deletedAt))),
    db
      .select()
      .from(incomePersons)
      .where(and(eq(incomePersons.userId, userId), isNull(incomePersons.deletedAt))),
    db.select().from(incomes).where(and(eq(incomes.userId, userId), isNull(incomes.deletedAt))),
    db.select().from(utilities).where(and(eq(utilities.userId, userId), isNull(utilities.deletedAt))),
    db
      .select()
      .from(netWorthEntries)
      .where(and(eq(netWorthEntries.userId, userId), isNull(netWorthEntries.deletedAt))),
    db
      .select()
      .from(offsetItems)
      .where(and(eq(offsetItems.userId, userId), isNull(offsetItems.deletedAt))),
  ]);

  return {
    accounts: accountRows,
    transactions: transactionRows,
    categories: categoryRows,
    budgets: budgetRows,
    expenses: expenseRows,
    incomePersons: incomePersonRows,
    incomes: incomeRows,
    utilities: utilityRows,
    netWorthEntries: netWorthRows,
    offsetItems: offsetItemRows,
  };
}

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get<{ Querystring: ExportQuery }>("/export", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          format: { type: "string", enum: ["csv", "json"], default: "csv" },
        },
      },
    },
    handler: async (request, reply) => {
      const userId = request.user.id;
      const format = request.query.format ?? "csv";
      const timestamp = new Date().toISOString().slice(0, 10);
      const data = await collectExportData(userId);

      if (format === "json") {
        reply.header(
          "Content-Disposition",
          `attachment; filename="budget-home-export-${timestamp}.json"`,
        );
        reply.type("application/json");
        return reply.send(JSON.stringify(data, null, 2));
      }

      const zip = createZip([
        {
          name: "accounts.csv",
          data: toCsv(data.accounts, [
            "id",
            "name",
            "type",
            "currency",
            "currentBalance",
            "createdAt",
          ]),
        },
        {
          name: "transactions.csv",
          data: toCsv(data.transactions, [
            "id",
            "accountId",
            "categoryId",
            "amount",
            "date",
            "description",
            "isRecurring",
            "createdAt",
          ]),
        },
        {
          name: "categories.csv",
          data: toCsv(data.categories, ["id", "name", "color", "icon", "parentCategoryId"]),
        },
        {
          name: "budgets.csv",
          data: toCsv(data.budgets, [
            "id",
            "categoryId",
            "period",
            "limitAmount",
            "startDate",
            "createdAt",
          ]),
        },
        {
          name: "expenses.csv",
          data: toCsv(data.expenses, [
            "id",
            "name",
            "amount",
            "currency",
            "frequency",
            "createdAt",
          ]),
        },
        {
          name: "income_persons.csv",
          data: toCsv(data.incomePersons, ["id", "name", "createdAt"]),
        },
        {
          name: "income.csv",
          data: toCsv(data.incomes, [
            "id",
            "personId",
            "name",
            "date",
            "amount",
            "currency",
            "frequency",
            "createdAt",
          ]),
        },
        {
          name: "utilities.csv",
          data: toCsv(data.utilities, [
            "id",
            "type",
            "date",
            "amount",
            "currency",
            "serviceDays",
            "createdAt",
          ]),
        },
        {
          name: "net_worth_entries.csv",
          data: toCsv(data.netWorthEntries, [
            "id",
            "section",
            "type",
            "description",
            "amount",
            "month",
            "createdAt",
          ]),
        },
        {
          name: "offset_items.csv",
          data: toCsv(data.offsetItems, ["id", "expenseId", "createdAt"]),
        },
      ]);

      reply.header(
        "Content-Disposition",
        `attachment; filename="budget-home-export-${timestamp}.zip"`,
      );
      reply.type("application/zip");
      return reply.send(zip);
    },
  });
}
