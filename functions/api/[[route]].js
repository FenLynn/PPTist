const INTERNAL_WORKER_ORIGIN = 'https://sci-worker.internal';

function normalizeWorkerBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.includes('example.com')) return '';
  return raw.replace(/\/$/, '');
}

function getWorkerHttpBase(env) {
  return normalizeWorkerBaseUrl(env.SCI_WORKER_SERVICE_BASE || env.SCI_WORKER_ORIGIN);
}

async function createProxyRequest(request, targetOrigin, extraHeaders = {}) {
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`${sourceUrl.pathname}${sourceUrl.search}`, targetOrigin);
  const headers = new Headers(request.headers);

  Object.entries(extraHeaders || {}).forEach(([key, value]) => {
    if (value && !headers.has(key)) headers.set(key, value);
  });

  const init = {
    method: request.method,
    headers,
    redirect: request.redirect
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.clone().arrayBuffer();
  }

  return new Request(targetUrl.toString(), init);
}

async function proxyToWorker(request, env) {
  const failures = [];

  if (env.WORKER && typeof env.WORKER.fetch === 'function') {
    try {
      const bindingRequest = await createProxyRequest(request, INTERNAL_WORKER_ORIGIN);
      const response = await env.WORKER.fetch(bindingRequest);
      return { response, transport: 'binding' };
    } catch (error) {
      failures.push({ transport: 'binding', message: error.message });
    }
  }

  const httpBase = getWorkerHttpBase(env);
  if (httpBase) {
    try {
      const authHeader = String(env.SCI_WORKER_SHARED_SECRET || '').trim();
      const httpRequest = await createProxyRequest(request, httpBase, authHeader ? { Authorization: `Bearer ${authHeader}` } : {});
      const response = await fetch(httpRequest);
      return { response, transport: 'http' };
    } catch (error) {
      failures.push({ transport: 'http', message: error.message });
    }
  }

  if (!failures.length) {
    throw new Error("Service Binding 'WORKER' or SCI_WORKER_SERVICE_BASE / SCI_WORKER_ORIGIN is not configured in Cloudflare Pages.");
  }

  throw new Error(failures.map(item => `${item.transport}: ${item.message}`).join(' | '));
}

export async function onRequest(context) {
  try {
    const { response, transport } = await proxyToWorker(context.request, context.env);
    const proxied = new Response(response.body, response);
    proxied.headers.set('X-Sci-Worker-Transport', transport);
    return proxied;
  } catch (error) {
    const route = new URL(context.request.url).pathname;
    return new Response(JSON.stringify({ error: 'Failed to connect to worker', route, detail: error.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}