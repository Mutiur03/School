const trimTrailingSlash = (value) => value.replace(/\/+$/, "");

const getTenantSlug = (hostname, tenantHostSuffix) => {
  const suffix = tenantHostSuffix.toLowerCase();
  const lowerHostname = hostname.toLowerCase();

  if (!lowerHostname.endsWith(suffix)) return null;

  const slug = lowerHostname.slice(0, -suffix.length).trim();
  return slug || null;
};

const buildTargetUrl = ({ requestUrl, targetOrigin }) => {
  const targetUrl = new URL(requestUrl.toString());
  const origin = new URL(targetOrigin);

  targetUrl.protocol = origin.protocol;
  targetUrl.hostname = origin.hostname;
  targetUrl.port = origin.port;

  return targetUrl;
};

const cloneHeaders = ({ request, originalHost, slug }) => {
  const headers = new Headers(request.headers);
  headers.set("x-school-subdomain", slug);
  headers.set("x-tenant-host", originalHost);

  return headers;
};

const resolveTenantTarget = (hostname, env) => {
  const clientHostSuffix = String(
    env.CLIENT_HOST_SUFFIX || "-school.mutiurrahman.com",
  )
    .trim()
    .toLowerCase();
  const dashboardHostSuffix = String(
    env.DASHBOARD_HOST_SUFFIX || "-dashboard.mutiurrahman.com",
  )
    .trim()
    .toLowerCase();

  const clientSlug = getTenantSlug(hostname, clientHostSuffix);
  if (clientSlug) {
    return {
      slug: clientSlug,
      origin: trimTrailingSlash(
        String(env.CLIENT_PAGES_ORIGIN || "https://lbp-client.pages.dev").trim(),
      ),
    };
  }

  const dashboardSlug = getTenantSlug(hostname, dashboardHostSuffix);
  if (dashboardSlug) {
    return {
      slug: dashboardSlug,
      origin: trimTrailingSlash(
        String(
          env.DASHBOARD_PAGES_ORIGIN || "https://lbp-dashboard.pages.dev",
        ).trim(),
      ),
    };
  }

  return null;
};

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
    const target = resolveTenantTarget(requestUrl.hostname, env);

    if (!target) {
      return new Response("Unknown tenant host", { status: 404 });
    }

    const targetUrl = buildTargetUrl({
      requestUrl,
      targetOrigin: target.origin,
    });

    const proxiedRequest = new Request(targetUrl.toString(), {
      method: request.method,
      headers: cloneHeaders({
        request,
        originalHost: requestUrl.hostname,
        slug: target.slug,
      }),
      body: request.body,
      redirect: "manual",
      cf: request.cf,
    });

    return fetch(proxiedRequest);
  },
};
