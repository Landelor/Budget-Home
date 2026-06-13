import { useState, useCallback, useEffect } from "react";
import { login as apiLogin, register as apiRegister, logout as apiLogout } from "../api/auth.js";

interface AuthState {
  isAuthenticated: boolean;
  error: string | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: !!localStorage.getItem("accessToken"),
    error: null,
    loading: false,
  });

  useEffect(() => {
    function onExpired() {
      setState({ isAuthenticated: false, error: null, loading: false });
    }
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { accessToken, refreshToken } = await apiLogin(email, password);
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      setState({ isAuthenticated: true, error: null, loading: false });
    } catch (e) {
      setState({ isAuthenticated: false, error: (e as Error).message, loading: false });
    }
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      await apiRegister(email, password);
      const { accessToken, refreshToken } = await apiLogin(email, password);
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      setState({ isAuthenticated: true, error: null, loading: false });
    } catch (e) {
      setState({ isAuthenticated: false, error: (e as Error).message, loading: false });
    }
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem("refreshToken") ?? "";
    try {
      await apiLogout(refreshToken);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      setState({ isAuthenticated: false, error: null, loading: false });
    }
  }, []);

  return { ...state, login, register, logout };
}
