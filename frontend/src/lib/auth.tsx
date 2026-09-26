"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "./api";
import type { Attendance, User } from "./types";

interface AuthState {
  user: User | null;
  attendance: Attendance | null;
  loading: boolean;
  isManager: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  setAttendance: (a: Attendance) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<{ user: User; attendance: Attendance }>("/auth/me");
      setUser(me.user);
      setAttendance(me.attendance);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onUnauthorized = () => {
      setUser(null);
      setAttendance(null);
    };
    window.addEventListener("tb:unauthorized", onUnauthorized);
    return () => window.removeEventListener("tb:unauthorized", onUnauthorized);
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ access_token: string; user: User; attendance: Attendance }>("/auth/login", {
      email,
      password,
    });
    setToken(res.access_token);
    setUser(res.user);
    setAttendance(res.attendance);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setAttendance(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      attendance,
      loading,
      isManager: user?.role === "admin" || user?.role === "manager",
      login,
      logout,
      refresh,
      setAttendance,
    }),
    [user, attendance, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
