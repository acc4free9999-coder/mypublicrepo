(function (g) {
  function configuration(config) {
    let url;
    try { url = new URL(config.url); } catch { throw new Error('Set your Supabase project URL and publishable key in supabase-config.js first.'); }
    if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) ||
        url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Use your HTTPS Supabase project URL (https://PROJECT.supabase.co).');
    }
    const key = config.publishableKey;
    if (typeof key !== 'string' || !key) throw new Error('Set the public Supabase publishable key in supabase-config.js.');
    if (!key.startsWith('sb_publishable_')) {
      let payload;
      try { payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); }
      catch { throw new Error('Use a publishable key or legacy anon key, never a secret/service_role key.'); }
      if (payload.role !== 'anon') throw new Error('Only public publishable/anon keys are allowed in the extension.');
    }
    return { url: url.origin, key };
  }
  function create({ config, vault, fetch, now = () => Date.now() }) {
    let refreshing;
    async function request(path, body, token, method = 'POST') {
      const { url, key } = configuration(config);
      const response = await fetch(`${url}${path}`, {
        method, headers: { apikey: key, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        redirect: 'error', signal: AbortSignal.timeout(30000),
      });
      const text = await response.text();
      let data;
      try { data = text ? JSON.parse(text) : null; }
      catch { throw new Error(`Supabase returned an invalid response (${response.status}).`); }
      if (!response.ok) {
        const error = new Error(data?.msg || data?.message || data?.error_description || data?.error || `Supabase request failed (${response.status}).`);
        error.status = response.status;
        throw error;
      }
      return data;
    }
    function session(data) {
      const expiry = data?.expires_at ?? Math.floor(now() / 1000) + data?.expires_in;
      if (typeof data?.access_token !== 'string' || !data.access_token ||
          typeof data.refresh_token !== 'string' || !data.refresh_token ||
          typeof data.user?.id !== 'string' || !data.user.id ||
          (data.expires_at == null && (typeof data.expires_in !== 'number' || data.expires_in <= 0)) ||
          !Number.isFinite(expiry) || expiry <= 0) {
        throw new Error('Invalid Supabase authentication response.');
      }
      return { ...data, expires_at: expiry };
    }
    async function refresh() {
      if (refreshing) return refreshing;
      refreshing = (async () => {
        const old = await vault.get();
        if (!old) throw new Error('Sign in to resume automatic sync.');
        const data = session(await request('/auth/v1/token?grant_type=refresh_token', { refresh_token: old.refresh_token }));
        if (data.user.id !== old.user.id) throw new Error('Authentication identity changed. Sign in again.');
        await vault.set(data);
        return data;
      })().finally(() => { refreshing = null; });
      return refreshing;
    }
    async function token() {
      const data = await vault.get();
      if (!data) throw new Error('Sign in to resume automatic sync.');
      return data.expires_at * 1000 < now() + 60000 ? (await refresh()).access_token : data.access_token;
    }
    async function authenticated(path, body, method) {
      try { return await request(path, body, await token(), method); }
      catch (err) {
        if (err.status !== 401) throw err;
        return request(path, body, (await refresh()).access_token, method);
      }
    }
    return {
      configured: () => { configuration(config); return true; },
      signIn: async (email, password) => session(await request('/auth/v1/token?grant_type=password', { email, password })),
      signUp: (email, password) => request('/auth/v1/signup', { email, password }),
      save: (data) => vault.set(data),
      user: async () => (await vault.get())?.user || null,
      async signOut() {
        const data = await vault.get();
        await vault.clear();
        if (data) await request('/auth/v1/logout?scope=local', undefined, data.access_token);
      },
      rpc: (name, body = {}) => authenticated(`/rest/v1/rpc/${name}`, body),
    };
  }
  g.SupabaseApi = { create, configuration };
  if (typeof module !== 'undefined') module.exports = g.SupabaseApi;
})(globalThis);
