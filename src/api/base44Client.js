// The app's client for Nebulux's own backend (the /api routes in functions/api/[[path]].js).
// It used to be the Base44 SDK, which brought axios and socket.io along: about 370 KB on every
// page load, for calls that are now all plain JSON to this same site. This is a small fetch
// version with the same shape (base44.auth / base44.entities / base44.functions), so every
// caller keeps working as before:
//   - auth and entities resolve to the response body and fail with a Base44Error-style error
//     ({ message, status, code, data }),
//   - functions.invoke resolves to an axios-style response ({ data, status, headers }) and fails
//     with an axios-style error ({ message, status, response: { data, status } }).
import { appParams } from '@/lib/app-params';

const { appId, functionsVersion } = appParams;
let token = appParams.token || null;

const STORAGE_KEYS = ["base44_access_token", "token"];
const save = (value) => {
  try {
    for (const k of STORAGE_KEYS) value ? window.localStorage.setItem(k, value) : window.localStorage.removeItem(k);
  } catch {
    /* storage blocked: the token still works for this page */
  }
};

function headers(extra, json = true) {
  const h = { Accept: "application/json", "X-App-Id": String(appId), ...extra };
  if (json) h["Content-Type"] = "application/json";
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function query(params) {
  const qs = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return qs ? `?${qs}` : "";
}

async function readBody(res) {
  const text = await res.text();
  if (!text) return "";
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function networkError(e) {
  const err = new Error("Network Error");
  err.code = "ERR_NETWORK";
  err.cause = e;
  return err;
}

// Auth and entities: the body, or a Base44Error-style error.
async function call(method, path, { params, data } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}${query(params)}`, {
      method,
      headers: headers(),
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  } catch (e) {
    throw networkError(e);
  }
  const body = await readBody(res);
  if (res.ok) return body;
  const message = body?.error?.message || body?.message || body?.detail || `Request failed with status code ${res.status}`;
  const err = new Error(message);
  err.name = "Base44Error";
  err.status = res.status;
  err.code = body?.error?.code ?? body?.code;
  err.data = body;
  throw err;
}

function entity(name) {
  const base = `/apps/${appId}/entities/${name}`;
  const fields = (f) => (Array.isArray(f) ? f.join(",") : f);
  const read = (sort, limit, skip, f, q) => call("GET", base, { params: { q: q ? JSON.stringify(q) : undefined, sort, limit, skip, fields: fields(f) } });
  return {
    list: (sort, limit, skip, f) => read(sort, limit, skip, f),
    filter: (q, sort, limit, skip, f) => read(sort, limit, skip, f, q),
    get: (id) => call("GET", `${base}/${id}`),
    create: (data) => call("POST", base, { data }),
    update: (id, data) => call("PUT", `${base}/${id}`, { data }),
    delete: (id) => call("DELETE", `${base}/${id}`),
    deleteMany: (q) => call("DELETE", base, { data: q }),
    bulkCreate: (data) => call("POST", `${base}/bulk`, { data }),
    count: async (q) => (await call("GET", `${base}/count`, { params: { q: q ? JSON.stringify(q) : undefined } })).count,
  };
}

const entities = new Proxy({}, {
  get: (_, name) => (typeof name !== "string" || name === "then" || name.startsWith("_") ? undefined : entity(name)),
});

const functions = {
  async invoke(name, data) {
    if (typeof data === "string") throw new Error(`Function ${name} must receive an object with named parameters, received: ${data}`);
    let body;
    let json = true;
    if (data instanceof FormData || (data && Object.values(data).some((v) => v instanceof File))) {
      if (data instanceof FormData) body = data;
      else {
        body = new FormData();
        for (const [k, v] of Object.entries(data)) {
          if (v instanceof File) body.append(k, v, v.name);
          else body.append(k, typeof v === "object" && v !== null ? JSON.stringify(v) : v);
        }
      }
      json = false; // the browser sets the multipart boundary itself
    } else {
      body = JSON.stringify(data === undefined ? {} : data);
    }
    let res;
    try {
      res = await fetch(`/api/apps/${appId}/functions/${name}`, {
        method: "POST",
        headers: headers(functionsVersion ? { "Base44-Functions-Version": functionsVersion } : {}, json),
        body,
      });
    } catch (e) {
      throw networkError(e);
    }
    const response = { data: await readBody(res), status: res.status, statusText: res.statusText, headers: res.headers };
    if (res.ok) return response;
    const err = new Error(`Request failed with status code ${res.status}`);
    err.name = "AxiosError";
    err.code = res.status >= 500 ? "ERR_BAD_RESPONSE" : "ERR_BAD_REQUEST";
    err.status = res.status;
    err.response = response;
    throw err;
  },
};

let pendingMe = null;
const auth = {
  hasToken: () => !!token,
  me() {
    if (!pendingMe) pendingMe = call("GET", `/apps/${appId}/entities/User/me`).finally(() => (pendingMe = null));
    return pendingMe;
  },
  updateMe: (data) => call("PUT", `/apps/${appId}/entities/User/me`, { data }),
  setToken(value, saveToStorage = true) {
    if (!value) return;
    pendingMe = null;
    token = value;
    if (saveToStorage) save(value);
  },
  logout(redirectUrl) {
    pendingMe = null;
    token = null;
    save(null);
    window.location.href = `/api/apps/auth/logout?from_url=${encodeURIComponent(redirectUrl || window.location.href)}`;
  },
  redirectToLogin(nextUrl) {
    const to = nextUrl ? new URL(nextUrl, window.location.origin).toString() : window.location.href;
    window.location.href = `/login?from_url=${encodeURIComponent(to)}`;
  },
  loginWithProvider(provider, fromUrl = "/") {
    const to = new URL(fromUrl, window.location.origin).toString();
    window.location.href = `/api/apps/auth${provider === "google" ? "" : `/${provider}`}/login?app_id=${appId}&from_url=${encodeURIComponent(to)}`;
  },
  async loginViaEmailPassword(email, password, turnstileToken) {
    const r = await call("POST", `/apps/${appId}/auth/login`, { data: { email, password, ...(turnstileToken ? { turnstile_token: turnstileToken } : {}) } });
    if (r?.access_token) this.setToken(r.access_token);
    return { access_token: r?.access_token, user: r?.user };
  },
  async isAuthenticated() {
    try {
      await this.me();
      return true;
    } catch {
      return false;
    }
  },
  register: (payload) => call("POST", `/apps/${appId}/auth/register`, { data: payload }),
  verifyOtp: ({ email, otpCode }) => call("POST", `/apps/${appId}/auth/verify-otp`, { data: { email, otp_code: otpCode } }),
  resendOtp: (email) => call("POST", `/apps/${appId}/auth/resend-otp`, { data: { email } }),
  resetPasswordRequest: (email) => call("POST", `/apps/${appId}/auth/reset-password-request`, { data: { email } }),
  resetPassword: ({ resetToken, newPassword }) => call("POST", `/apps/${appId}/auth/reset-password`, { data: { reset_token: resetToken, new_password: newPassword } }),
  changePassword: ({ userId, currentPassword, newPassword }) => call("POST", `/apps/${appId}/auth/change-password`, { data: { user_id: userId, current_password: currentPassword, new_password: newPassword } }),
};

// The public app settings (lib/AuthContext.jsx), same errors as auth and entities.
export const getPublicSettings = () => call("GET", `/apps/public/prod/public-settings/by-id/${appId}`);

export const base44 = { auth, entities, functions, setToken: (t) => auth.setToken(t) };
