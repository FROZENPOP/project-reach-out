// Admin client for /admin/. The passphrase lives in sessionStorage and only ever travels in the
// Authorization header. No DOM, so node --test can drive it with a stubbed fetch and storage.
import { api, ApiError } from '../js/site.js';

const KEY = 'reachout.admin';
export const TABLES = ['experiment', 'pulse', 'answers', 'counters'];
export const BAD_PASS = 'That passphrase is not right.';

export function createAdmin(storage) {
  const state = { status: 'pending', rows: [] };
  const token = () => storage.getItem(KEY);

  async function guard(promise) {
    try {
      return await promise;
    } catch (err) {
      if (err.status === 401) {
        storage.removeItem(KEY);
        throw new ApiError(401, 'unauthorized', BAD_PASS);
      }
      throw err;
    }
  }

  return {
    state,
    hasToken: () => Boolean(token()),
    lock: () => storage.removeItem(KEY),

    async unlock(pass) {
      storage.setItem(KEY, pass);
      return this.list('pending');
    },

    async list(status) {
      const rows = await guard(api(`/api/admin/answers?status=${status}`, { token: token() }));
      state.status = status;
      state.rows = rows;
      return rows;
    },

    // Approve or reject; the row leaves the list being shown.
    async setStatus(id, status) {
      await guard(api(`/api/admin/answers/${id}`, { method: 'POST', body: { status }, token: token() }));
      if (status !== state.status) state.rows = state.rows.filter((r) => r.id !== id);
      return state.rows;
    },

    // Fetches a CSV with the header and returns it as a Blob (api() only does JSON).
    async csv(table) {
      return guard(
        (async () => {
          let res;
          try {
            res = await fetch(`/api/admin/export.csv?table=${table}`, { headers: { Authorization: `Bearer ${token()}` } });
          } catch {
            throw new ApiError(0, 'network', 'Could not reach the server. Check your connection and try again.');
          }
          if (!res.ok) throw new ApiError(res.status, 'http_error', `Download failed (${res.status}).`);
          return res.blob();
        })(),
      );
    },
  };
}
