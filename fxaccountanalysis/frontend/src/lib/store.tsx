import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, tokenStore } from './api';
import type { Account, User } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
}

interface AccountState {
  accounts: Account[];
  activeAccountId: number | null;
  setActiveAccountId: (id: number | null) => void;
  refreshAccounts: () => Promise<void>;
  accountsLoading: boolean;
  accountsError: string | null;
}

const AuthContext = createContext<AuthState | null>(null);
const AccountContext = createContext<AccountState | null>(null);

const ACTIVE_KEY = 'fxa.activeAccount';

export function AppProviders({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [activeAccountId, setActiveAccountIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem(ACTIVE_KEY);
    return stored ? Number(stored) : null;
  });

  const setActiveAccountId = useCallback((id: number | null) => {
    setActiveAccountIdState(id);
    if (id === null) localStorage.removeItem(ACTIVE_KEY);
    else localStorage.setItem(ACTIVE_KEY, String(id));
  }, []);

  const refreshAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      const list = await api.listAccounts();
      setAccounts(list);
      setActiveAccountIdState((current) => {
        if (current && list.some((a) => a.id === current)) return current;
        return list.length ? list[0].id : null;
      });
    } catch (error) {
      setAccountsError(error instanceof Error ? error.message : 'Failed to load accounts');
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) void refreshAccounts();
    else setAccounts([]);
  }, [user, refreshAccounts]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login({ email, password });
    tokenStore.set(result.access_token);
    setUser(result.user);
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    const result = await api.register({ email, password, full_name: fullName || undefined });
    tokenStore.set(result.access_token);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    localStorage.removeItem(ACTIVE_KEY);
    setUser(null);
    setAccounts([]);
    setActiveAccountIdState(null);
  }, []);

  const authValue = useMemo<AuthState>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  const accountValue = useMemo<AccountState>(
    () => ({
      accounts,
      activeAccountId,
      setActiveAccountId,
      refreshAccounts,
      accountsLoading,
      accountsError,
    }),
    [accounts, activeAccountId, setActiveAccountId, refreshAccounts, accountsLoading, accountsError],
  );

  return (
    <AuthContext.Provider value={authValue}>
      <AccountContext.Provider value={accountValue}>{children}</AccountContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AppProviders');
  return context;
}

export function useAccounts(): AccountState {
  const context = useContext(AccountContext);
  if (!context) throw new Error('useAccounts must be used inside AppProviders');
  return context;
}
