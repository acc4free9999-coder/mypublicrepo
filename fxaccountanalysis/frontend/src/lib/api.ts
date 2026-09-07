import type {
  Account,
  AnalyticsSummary,
  ImportResult,
  PeriodKey,
  Trade,
  TradeChart,
  TradeFilters,
  TradePage,
  User,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';
const TOKEN_KEY = 'fxa.token';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const isFormData = init.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  if (response.status === 401) {
    tokenStore.clear();
    throw new ApiError('Your session expired. Please sign in again.', 401);
  }
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = data?.detail;
    let message = `Request failed (${response.status})`;
    if (typeof detail === 'string') message = detail;
    else if (Array.isArray(detail) && detail.length > 0) {
      // FastAPI validation errors arrive as a list of {loc, msg} objects.
      message = detail
        .map((item: { loc?: (string | number)[]; msg?: string }) => {
          const field = item.loc?.filter((part) => part !== 'body').join('.');
          return field ? `${field}: ${item.msg}` : item.msg;
        })
        .join('; ');
    }
    throw new ApiError(message, response.status);
  }
  return data as T;
}

function queryString(params: object): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]: [string, unknown]) => {
    if (value === undefined || value === null || value === '') return;
    search.append(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  register: (body: { email: string; password: string; full_name?: string }) =>
    request<{ access_token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  me: () => request<User>('/auth/me'),

  listAccounts: () => request<Account[]>('/accounts'),

  createAccount: (body: {
    name: string;
    login: string;
    password?: string;
    server?: string;
    broker: string;
    provider?: string;
    starting_balance?: number;
  }) => request<Account>('/accounts', { method: 'POST', body: JSON.stringify(body) }),

  importStatement: (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    // No Content-Type header: the browser must set the multipart boundary.
    return request<ImportResult>(`/accounts/${id}/import`, { method: 'POST', body: form });
  },

  deleteAccount: (id: number) => request<void>(`/accounts/${id}`, { method: 'DELETE' }),

  syncAccount: (id: number) =>
    request<{ success: boolean; trades_synced: number; message: string; status: string }>(
      `/accounts/${id}/sync`,
      { method: 'POST' },
    ),

  listTrades: (
    filters: TradeFilters & {
      page?: number;
      page_size?: number;
      sort_by?: string;
      sort_dir?: 'asc' | 'desc';
      include_open?: boolean;
    },
  ) => request<TradePage>(`/trades${queryString(filters)}`),

  listSymbols: (accountId?: number | null) =>
    request<string[]>(`/trades/symbols${queryString({ account_id: accountId })}`),

  getTrade: (id: number) => request<Trade>(`/trades/${id}`),

  getTradeChart: (id: number, timeframe?: string) =>
    request<TradeChart>(`/trades/${id}/chart${queryString({ timeframe })}`),

  analytics: (period: PeriodKey, filters: TradeFilters) =>
    request<AnalyticsSummary>(`/analytics/summary${queryString({ period, ...filters })}`),
};
