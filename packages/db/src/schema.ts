import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const accountTypeEnum = pgEnum("account_type", [
  "checking",
  "savings",
  "credit",
  "cash",
]);

export const budgetPeriodEnum = pgEnum("budget_period", ["monthly", "weekly"]);

export const expenseFrequencyEnum = pgEnum("expense_frequency", [
  "fortnightly",
  "monthly",
  "yearly",
]);

export const utilityTypeEnum = pgEnum("utility_type", ["gas", "power", "water"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  defaultCurrency: varchar("default_currency", { length: 3 }).notNull().default("USD"),
  darkMode: boolean("dark_mode").notNull().default(false),
  dateFormat: varchar("date_format", { length: 3 }).notNull().default("MDY"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).notNull(),
  icon: varchar("icon", { length: 50 }).notNull(),
  parentCategoryId: uuid("parent_category_id").references(
    (): AnyPgColumn => categories.id,
    { onDelete: "set null" },
  ),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  type: accountTypeEnum("type").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  currentBalance: numeric("current_balance", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  isRecurring: boolean("is_recurring").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  period: budgetPeriodEnum("period").notNull(),
  limitAmount: numeric("limit_amount", { precision: 12, scale: 2 }).notNull(),
  startDate: date("start_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  frequency: expenseFrequencyEnum("frequency").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const incomePersons = pgTable("income_persons", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const incomes = pgTable("incomes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  personId: uuid("person_id").references(() => incomePersons.id, { onDelete: "set null" }),
  name: varchar("name", { length: 100 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  frequency: expenseFrequencyEnum("frequency").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const utilities = pgTable("utilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: utilityTypeEnum("type").notNull(),
  date: date("date").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  serviceDays: integer("service_days").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations — used by Drizzle's relational query API

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  transactions: many(transactions),
  budgets: many(budgets),
  categories: many(categories),
  expenses: many(expenses),
  utilities: many(utilities),
  incomePersons: many(incomePersons),
  incomes: many(incomes),
  refreshTokens: many(refreshTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  parent: one(categories, {
    fields: [categories.parentCategoryId],
    references: [categories.id],
    relationName: "category_parent",
  }),
  children: many(categories, { relationName: "category_parent" }),
  transactions: many(transactions),
  budgets: many(budgets),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(users, { fields: [budgets.userId], references: [users.id] }),
  category: one(categories, {
    fields: [budgets.categoryId],
    references: [categories.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  user: one(users, { fields: [expenses.userId], references: [users.id] }),
}));

export const utilitiesRelations = relations(utilities, ({ one }) => ({
  user: one(users, { fields: [utilities.userId], references: [users.id] }),
}));

export const incomePersonsRelations = relations(incomePersons, ({ one, many }) => ({
  user: one(users, { fields: [incomePersons.userId], references: [users.id] }),
  incomes: many(incomes),
}));

export const incomesRelations = relations(incomes, ({ one }) => ({
  user: one(users, { fields: [incomes.userId], references: [users.id] }),
  person: one(incomePersons, { fields: [incomes.personId], references: [incomePersons.id] }),
}));

// Inferred TypeScript types

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;

export type Utility = typeof utilities.$inferSelect;
export type NewUtility = typeof utilities.$inferInsert;

export type IncomePerson = typeof incomePersons.$inferSelect;
export type NewIncomePerson = typeof incomePersons.$inferInsert;

export type Income = typeof incomes.$inferSelect;
export type NewIncome = typeof incomes.$inferInsert;

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
