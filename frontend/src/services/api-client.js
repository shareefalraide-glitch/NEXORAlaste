export class ApiError extends Error {
  constructor(message, { status = 0, code = 'network_error', requestId = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export function createApiClient({ base = '/api/v1', fetchImpl = globalThis.fetch } = {}) {
  let accessToken = '';
  let refreshToken = '';
  let refreshInFlight = null;
  let sessionGeneration = 0;

  function clearSession() {
    sessionGeneration += 1;
    accessToken = '';
    refreshToken = '';
    refreshInFlight = null;
  }

  const urlFor = path => `${base.replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`;

  async function send(path, options = {}, token = '') {
    const headers = new Headers(options.headers || {});
    if (options.body !== undefined && !headers.has('Content-Type'))
      headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    let response;
    try {
      response = await fetchImpl(urlFor(path), {
        ...options,
        headers,
        cache: 'no-store',
        credentials: 'same-origin',
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new ApiError('تعذر الاتصال بخادم NEXORA. تحقق من تشغيل الـAPI وإعداد الوكيل.', {
        code: 'network_error',
      });
    }
    if (response.status === 204) return null;
    const contentType = response.headers.get('content-type') || '';
    let body = null;
    if (contentType.includes('json')) {
      try {
        body = await response.json();
      } catch {
        throw new ApiError('أعاد الخادم استجابة JSON غير صالحة.', {
          status: response.status,
          code: 'invalid_response',
        });
      }
    } else {
      const text = await response.text().catch(() => '');
      if (!response.ok) {
        throw new ApiError('رفض الخادم الطلب أو لم تتوفر الخدمة المطلوبة.', {
          status: response.status,
          code: 'http_error',
        });
      }
      return text || null;
    }
    if (!response.ok) {
      const error = body?.error || {};
      throw new ApiError(error.message || 'تعذر إكمال الطلب.', {
        status: response.status,
        code: error.code || 'http_error',
        requestId: error.request_id || response.headers.get('x-request-id') || '',
      });
    }
    return body;
  }

  function acceptTokens(value) {
    if (
      !value ||
      typeof value.access_token !== 'string' ||
      typeof value.refresh_token !== 'string' ||
      value.token_type !== 'Bearer'
    )
      throw new ApiError('صيغة رمز الجلسة التي أعادها الخادم غير متوقعة.', {
        code: 'invalid_response',
      });
    accessToken = value.access_token;
    refreshToken = value.refresh_token;
  }

  async function refresh() {
    if (!refreshToken) throw new ApiError('انتهت الجلسة. سجّل الدخول مجددًا.', { status: 401 });
    if (refreshInFlight) return refreshInFlight;
    const generation = sessionGeneration;
    const currentRefreshToken = refreshToken;
    let task;
    task = (async () => {
      try {
        const value = await send('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: currentRefreshToken }),
        });
        if (sessionGeneration !== generation)
          throw new ApiError('تغيرت الجلسة أثناء تجديدها.', {
            status: 401,
            code: 'session_changed',
          });
        acceptTokens(value);
      } catch (error) {
        if (sessionGeneration === generation) clearSession();
        throw error;
      } finally {
        if (refreshInFlight === task) refreshInFlight = null;
      }
    })();
    refreshInFlight = task;
    return task;
  }

  async function request(path, { method = 'GET', body, headers, signal } = {}) {
    const options = {
      method,
      headers,
      signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    };
    try {
      return await send(path, options, accessToken);
    } catch (error) {
      if (error.status !== 401 || !refreshToken || path === '/auth/refresh') throw error;
      await refresh();
      return send(path, options, accessToken);
    }
  }

  return {
    async login(credentials) {
      clearSession();
      const generation = sessionGeneration;
      try {
        const tokens = await send('/auth/login', {
          method: 'POST',
          body: JSON.stringify(credentials),
        });
        if (sessionGeneration !== generation)
          throw new ApiError('تغيرت الجلسة أثناء تسجيل الدخول.', {
            status: 401,
            code: 'session_changed',
          });
        acceptTokens(tokens);
        return await request('/auth/me');
      } catch (error) {
        if (sessionGeneration === generation) clearSession();
        throw error;
      }
    },
    request,
    async logout() {
      try {
        if (accessToken) await request('/auth/logout', { method: 'POST' });
      } finally {
        clearSession();
      }
    },
    clear() {
      clearSession();
    },
    hasSession() {
      return Boolean(accessToken);
    },
  };
}

const apiBase = import.meta.env?.VITE_NEXORA_API_BASE_URL || '/api/v1';
export const apiClient = createApiClient({ base: apiBase });
