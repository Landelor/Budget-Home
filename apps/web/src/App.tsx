import { useState } from "react";
import { useAuth } from "./hooks/useAuth.js";
import { AuthPage } from "./pages/AuthPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { AccountsPage } from "./pages/AccountsPage.js";
import { TransactionsPage } from "./pages/TransactionsPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";

type Page = "dashboard" | "transactions" | "accounts" | "settings";

export function App() {
  const { isAuthenticated, loading, error, login, register, logout } = useAuth();
  const [page, setPage] = useState<Page>("dashboard");

  if (!isAuthenticated) {
    return (
      <AuthPage
        onLogin={login}
        onRegister={register}
        loading={loading}
        error={error}
      />
    );
  }

  if (page === "accounts") {
    return (
      <AccountsPage
        onLogout={logout}
        onNavigate={(p) => setPage(p as Page)}
      />
    );
  }

  if (page === "transactions") {
    return (
      <TransactionsPage
        onLogout={logout}
        onNavigate={(p) => setPage(p as Page)}
      />
    );
  }

  if (page === "settings") {
    return (
      <SettingsPage
        onLogout={logout}
        onNavigate={(p) => setPage(p as Page)}
      />
    );
  }

  return (
    <DashboardPage
      onLogout={logout}
      onNavigate={(p) => setPage(p as Page)}
    />
  );
}
