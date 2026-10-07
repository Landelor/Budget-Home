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
import { eq, or, isNull } from "drizzle-orm";
import { authenticate } from "../middleware/authenticate.js";

// Loose shape of an import payload — mirrors the /export JSON output.
// Each section is optional; row-level validation happens per-entity below
// so a handful of malformed rows don't block the rest of the import.
interface ImportPayload {
  accounts?: unknown[];
  transactions?: unknown[];
  categories?: unknown[];
  budgets?: unknown[];
  expenses?: unknown[];
  incomePersons?: unknown[];
  incomes?: unknown[];
  utilities?: unknown[];
  netWorthEntries?: unknown[];
  offsetItems?: unknown[];
}

interface SectionSummary {
  imported: number;
  skipped: number;
  errors: string[];
}

const ACCOUNT_TYPES = new Set(["checking", "savings", "credit", "cash"]);
const BUDGET_PERIODS = new Set(["monthly", "weekly"]);
const EXPENSE_FREQUENCIES = new Set(["fortnightly", "monthly", "yearly"]);
const UTILITY_TYPES = new Set(["gas", "power", "water"]);
const NET_WORTH_SECTIONS = new Set(["asset", "liability"]);
const NET_WORTH_TYPES = new Set(["property", "shares", "bank_account", "super", "loan"]);
const CURRENCY_RE = /^[A-Z]{3}$/;
const MAX_ERRORS_PER_SECTION = 20;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

function isFiniteNumeric(v: unknown): v is string | number {
  if (typeof v === "number") return Number.isFinite(v);
  return typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v));
}

function asAmountString(v: string | number): string {
  return Number(v).toFixed(2);
}

function asInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Math.trunc(Number(v));
  }
  return null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function normaliseCurrency(v: unknown): string {
  return isNonEmptyString(v) && CURRENCY_RE.test(v) ? v : "USD";
}

function arrayOf(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export async function importRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.post<{ Body: ImportPayload }>("/import", {
    schema: {
      body: {
        type: "object",
      },
    },
    handler: async (request, reply) => {
      const userId = request.user.id;
      const body = request.body ?? {};
      const sections: Record<string, SectionSummary> = {};

      // Run the whole import as one DB transaction: a failure partway
      // through (bad data, connection drop, etc.) rolls everything back
      // instead of leaving a half-imported, inconsistent dataset. Note this
      // shadows the outer `db` import for the rest of the handler so every
      // query below runs inside the transaction.
      await db.transaction(async (db) => {

      function newSection(name: string): SectionSummary {
        const section: SectionSummary = { imported: 0, skipped: 0, errors: [] };
        sections[name] = section;
        return section;
      }

      function recordSkip(section: SectionSummary, reason: string) {
        section.skipped++;
        if (section.errors.length < MAX_ERRORS_PER_SECTION) section.errors.push(reason);
      }

      // --- Categories: independent, but self-referencing via parentCategoryId,
      // so insert flat first then patch parent links in a second pass. ---
      const categorySummary = newSection("categories");
      const categoryIdMap = new Map<string, string>();
      const pendingParents: { newId: string; oldParentId: string }[] = [];

      for (const raw of arrayOf(body.categories)) {
        const row = asRecord(raw);
        if (!row || !isNonEmptyString(row.name) || !isNonEmptyString(row.color) || !isNonEmptyString(row.icon)) {
          recordSkip(categorySummary, "Category row skipped: missing name, color, or icon");
          continue;
        }
        const [inserted] = await db
          .insert(categories)
          .values({ userId, name: row.name, color: row.color, icon: row.icon })
          .returning({ id: categories.id });
        if (!inserted) {
          recordSkip(categorySummary, `Category "${row.name}": insert failed`);
          continue;
        }
        categorySummary.imported++;
        if (isNonEmptyString(row.id)) categoryIdMap.set(row.id, inserted.id);
        if (isNonEmptyString(row.parentCategoryId)) {
          pendingParents.push({ newId: inserted.id, oldParentId: row.parentCategoryId });
        }
      }

      for (const { newId, oldParentId } of pendingParents) {
        const mappedParent = categoryIdMap.get(oldParentId);
        if (mappedParent) {
          await db.update(categories).set({ parentCategoryId: mappedParent }).where(eq(categories.id, newId));
        }
      }

      // Categories visible to this user (their own, including newly imported
      // ones, plus shared global categories) — used to resolve references to
      // categories that weren't part of this import file.
      const visibleCategories = await db
        .select({ id: categories.id })
        .from(categories)
        .where(or(isNull(categories.userId), eq(categories.userId, userId)));
      const visibleCategoryIds = new Set(visibleCategories.map((c) => c.id));

      function resolveCategoryId(oldId: unknown): string | null {
        if (!isNonEmptyString(oldId)) return null;
        return categoryIdMap.get(oldId) ?? (visibleCategoryIds.has(oldId) ? oldId : null);
      }

      // --- Accounts ---
      const accountSummary = newSection("accounts");
      const accountIdMap = new Map<string, string>();
      for (const raw of arrayOf(body.accounts)) {
        const row = asRecord(raw);
        if (
          !row ||
          !isNonEmptyString(row.name) ||
          typeof row.type !== "string" ||
          !ACCOUNT_TYPES.has(row.type) ||
          !isFiniteNumeric(row.currentBalance)
        ) {
          recordSkip(accountSummary, "Account row skipped: invalid or missing fields");
          continue;
        }
        const [inserted] = await db
          .insert(accounts)
          .values({
            userId,
            name: row.name,
            type: row.type as "checking" | "savings" | "credit" | "cash",
            currency: normaliseCurrency(row.currency),
            currentBalance: asAmountString(row.currentBalance),
          })
          .returning({ id: accounts.id });
        if (!inserted) {
          recordSkip(accountSummary, `Account "${row.name}": insert failed`);
          continue;
        }
        accountSummary.imported++;
        if (isNonEmptyString(row.id)) accountIdMap.set(row.id, inserted.id);
      }

      // --- Expenses ---
      const expenseSummary = newSection("expenses");
      const expenseIdMap = new Map<string, string>();
      for (const raw of arrayOf(body.expenses)) {
        const row = asRecord(raw);
        if (
          !row ||
          !isNonEmptyString(row.name) ||
          !isFiniteNumeric(row.amount) ||
          typeof row.frequency !== "string" ||
          !EXPENSE_FREQUENCIES.has(row.frequency)
        ) {
          recordSkip(expenseSummary, "Expense row skipped: invalid or missing fields");
          continue;
        }
        const [inserted] = await db
          .insert(expenses)
          .values({
            userId,
            name: row.name,
            amount: asAmountString(row.amount),
            currency: normaliseCurrency(row.currency),
            frequency: row.frequency as "fortnightly" | "monthly" | "yearly",
          })
          .returning({ id: expenses.id });
        if (!inserted) {
          recordSkip(expenseSummary, `Expense "${row.name}": insert failed`);
          continue;
        }
        expenseSummary.imported++;
        if (isNonEmptyString(row.id)) expenseIdMap.set(row.id, inserted.id);
      }

      // --- Income persons ---
      const incomePersonSummary = newSection("incomePersons");
      const incomePersonIdMap = new Map<string, string>();
      for (const raw of arrayOf(body.incomePersons)) {
        const row = asRecord(raw);
        if (!row || !isNonEmptyString(row.name)) {
          recordSkip(incomePersonSummary, "Income person row skipped: missing name");
          continue;
        }
        const [inserted] = await db
          .insert(incomePersons)
          .values({ userId, name: row.name })
          .returning({ id: incomePersons.id });
        if (!inserted) {
          recordSkip(incomePersonSummary, `Income person "${row.name}": insert failed`);
          continue;
        }
        incomePersonSummary.imported++;
        if (isNonEmptyString(row.id)) incomePersonIdMap.set(row.id, inserted.id);
      }

      // --- Utilities (independent) ---
      const utilitySummary = newSection("utilities");
      for (const raw of arrayOf(body.utilities)) {
        const row = asRecord(raw);
        const serviceDays = row ? asInt(row.serviceDays) : null;
        if (
          !row ||
          typeof row.type !== "string" ||
          !UTILITY_TYPES.has(row.type) ||
          !isNonEmptyString(row.date) ||
          !isFiniteNumeric(row.amount) ||
          serviceDays === null
        ) {
          recordSkip(utilitySummary, "Utility row skipped: invalid or missing fields");
          continue;
        }
        const [inserted] = await db
          .insert(utilities)
          .values({
            userId,
            type: row.type as "gas" | "power" | "water",
            date: row.date,
            amount: asAmountString(row.amount),
            currency: normaliseCurrency(row.currency),
            serviceDays,
          })
          .returning({ id: utilities.id });
        if (!inserted) {
          recordSkip(utilitySummary, "Utility row: insert failed");
          continue;
        }
        utilitySummary.imported++;
      }

      // --- Net worth entries (independent) ---
      const netWorthSummary = newSection("netWorthEntries");
      for (const raw of arrayOf(body.netWorthEntries)) {
        const row = asRecord(raw);
        if (
          !row ||
          typeof row.section !== "string" ||
          !NET_WORTH_SECTIONS.has(row.section) ||
          typeof row.type !== "string" ||
          !NET_WORTH_TYPES.has(row.type) ||
          !isNonEmptyString(row.description) ||
          !isFiniteNumeric(row.amount) ||
          !isNonEmptyString(row.month)
        ) {
          recordSkip(netWorthSummary, "Net worth row skipped: invalid or missing fields");
          continue;
        }
        const [inserted] = await db
          .insert(netWorthEntries)
          .values({
            userId,
            section: row.section as "asset" | "liability",
            type: row.type as "property" | "shares" | "bank_account" | "super" | "loan",
            description: row.description,
            amount: asAmountString(row.amount),
            month: row.month,
          })
          .returning({ id: netWorthEntries.id });
        if (!inserted) {
          recordSkip(netWorthSummary, "Net worth row: insert failed");
          continue;
        }
        netWorthSummary.imported++;
      }

      // --- Transactions (needs accounts + categories) ---
      const transactionSummary = newSection("transactions");
      for (const raw of arrayOf(body.transactions)) {
        const row = asRecord(raw);
        if (
          !row ||
          !isNonEmptyString(row.accountId) ||
          !isFiniteNumeric(row.amount) ||
          !isNonEmptyString(row.date) ||
          !isNonEmptyString(row.description)
        ) {
          recordSkip(transactionSummary, "Transaction row skipped: invalid or missing fields");
          continue;
        }
        const newAccountId = accountIdMap.get(row.accountId);
        if (!newAccountId) {
          recordSkip(
            transactionSummary,
            `Transaction "${row.description}": referenced account not found in this import`,
          );
          continue;
        }
        const [inserted] = await db
          .insert(transactions)
          .values({
            accountId: newAccountId,
            userId,
            amount: asAmountString(row.amount),
            date: row.date,
            description: row.description,
            categoryId: resolveCategoryId(row.categoryId),
            isRecurring: row.isRecurring === true,
          })
          .returning({ id: transactions.id });
        if (!inserted) {
          recordSkip(transactionSummary, `Transaction "${row.description}": insert failed`);
          continue;
        }
        transactionSummary.imported++;
      }

      // --- Budgets (needs categories) ---
      const budgetSummary = newSection("budgets");
      for (const raw of arrayOf(body.budgets)) {
        const row = asRecord(raw);
        if (
          !row ||
          typeof row.period !== "string" ||
          !BUDGET_PERIODS.has(row.period) ||
          !isFiniteNumeric(row.limitAmount) ||
          !isNonEmptyString(row.startDate)
        ) {
          recordSkip(budgetSummary, "Budget row skipped: invalid or missing fields");
          continue;
        }
        const newCategoryId = resolveCategoryId(row.categoryId);
        if (!newCategoryId) {
          recordSkip(budgetSummary, "Budget row skipped: referenced category not found");
          continue;
        }
        const [inserted] = await db
          .insert(budgets)
          .values({
            userId,
            categoryId: newCategoryId,
            period: row.period as "monthly" | "weekly",
            limitAmount: asAmountString(row.limitAmount),
            startDate: row.startDate,
          })
          .returning({ id: budgets.id });
        if (!inserted) {
          recordSkip(budgetSummary, "Budget row: insert failed");
          continue;
        }
        budgetSummary.imported++;
      }

      // --- Incomes (needs income persons) ---
      const incomeSummary = newSection("incomes");
      for (const raw of arrayOf(body.incomes)) {
        const row = asRecord(raw);
        if (
          !row ||
          !isNonEmptyString(row.name) ||
          !isNonEmptyString(row.date) ||
          !isFiniteNumeric(row.amount) ||
          typeof row.frequency !== "string" ||
          !EXPENSE_FREQUENCIES.has(row.frequency)
        ) {
          recordSkip(incomeSummary, "Income row skipped: invalid or missing fields");
          continue;
        }
        const newPersonId = isNonEmptyString(row.personId)
          ? (incomePersonIdMap.get(row.personId) ?? null)
          : null;
        const [inserted] = await db
          .insert(incomes)
          .values({
            userId,
            personId: newPersonId,
            name: row.name,
            date: row.date,
            amount: asAmountString(row.amount),
            currency: normaliseCurrency(row.currency),
            frequency: row.frequency as "fortnightly" | "monthly" | "yearly",
          })
          .returning({ id: incomes.id });
        if (!inserted) {
          recordSkip(incomeSummary, `Income "${row.name}": insert failed`);
          continue;
        }
        incomeSummary.imported++;
      }

      // --- Offset items (needs expenses) ---
      const offsetItemSummary = newSection("offsetItems");
      for (const raw of arrayOf(body.offsetItems)) {
        const row = asRecord(raw);
        if (!row || !isNonEmptyString(row.expenseId)) {
          recordSkip(offsetItemSummary, "Offset item row skipped: missing expenseId");
          continue;
        }
        const newExpenseId = expenseIdMap.get(row.expenseId);
        if (!newExpenseId) {
          recordSkip(offsetItemSummary, "Offset item row skipped: referenced expense not found in this import");
          continue;
        }
        const [inserted] = await db
          .insert(offsetItems)
          .values({ userId, expenseId: newExpenseId })
          .returning({ id: offsetItems.id });
        if (!inserted) {
          recordSkip(offsetItemSummary, "Offset item row: insert failed");
          continue;
        }
        offsetItemSummary.imported++;
      }
      });

      const totalImported = Object.values(sections).reduce((sum, s) => sum + s.imported, 0);
      const totalSkipped = Object.values(sections).reduce((sum, s) => sum + s.skipped, 0);

      return reply.status(200).send({ totalImported, totalSkipped, sections });
    },
  });
}
