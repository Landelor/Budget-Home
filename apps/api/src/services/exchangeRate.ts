// Frankfurter.app provides ECB exchange rates, free, no API key required.
// Rates are updated at ~4pm CET on European trading days.

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface FrankfurterResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

interface RateCache {
  rates: Record<string, number>; // rates relative to USD base
  date: string;
  fetchedAt: number;
}

let cache: RateCache | null = null;

export async function getLatestRates(): Promise<{ rates: Record<string, number>; date: string }> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { rates: cache.rates, date: cache.date };
  }

  const res = await fetch("https://api.frankfurter.app/latest?from=USD");
  if (!res.ok) {
    if (cache) {
      // Return stale cache rather than failing completely
      return { rates: cache.rates, date: cache.date };
    }
    throw new Error(`Exchange rate API returned ${res.status}`);
  }

  const data = (await res.json()) as FrankfurterResponse;
  // Include USD itself at rate 1
  const rates: Record<string, number> = { USD: 1, ...data.rates };

  cache = { rates, date: data.date, fetchedAt: now };
  return { rates, date: data.date };
}

export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  if (!fromRate || !toRate) return amount;
  // rates are vs USD, so convert via USD
  return (amount / fromRate) * toRate;
}
