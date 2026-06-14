import { apiFetch } from "./client.js";

export interface UserSettings {
  defaultCurrency: string;
  darkMode: boolean;
  dateFormat: "MDY" | "DMY";
}

export const SUPPORTED_CURRENCIES = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "CHF", label: "CHF — Swiss Franc" },
  { code: "CNY", label: "CNY — Chinese Yuan" },
  { code: "INR", label: "INR — Indian Rupee" },
  { code: "BRL", label: "BRL — Brazilian Real" },
  { code: "MXN", label: "MXN — Mexican Peso" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "HKD", label: "HKD — Hong Kong Dollar" },
  { code: "NOK", label: "NOK — Norwegian Krone" },
  { code: "SEK", label: "SEK — Swedish Krona" },
  { code: "DKK", label: "DKK — Danish Krone" },
  { code: "NZD", label: "NZD — New Zealand Dollar" },
  { code: "ZAR", label: "ZAR — South African Rand" },
  { code: "KRW", label: "KRW — South Korean Won" },
  { code: "TRY", label: "TRY — Turkish Lira" },
];

export function getSettings(): Promise<UserSettings> {
  return apiFetch<UserSettings>("/settings");
}

export function updateSettings(body: Partial<UserSettings>): Promise<UserSettings> {
  return apiFetch<UserSettings>("/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
