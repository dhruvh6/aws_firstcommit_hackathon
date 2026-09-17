/**
 * Lambda entry point. Translates an API Gateway HTTP API (payload v2.0) proxy
 * event into a RouterRequest, and the RouterResponse back into a proxy result.
 *
 * OWNER: M3  (docs/08-TEAM-ROLES.md § 3)
 * See docs/05-ARCHITECTURE.md § 2 for why this is one router function rather
 * than one function per route.
 */
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';
import { handle, type RouterRequest } from './router.js';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? '*';

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': ALLOWED_ORIGIN,
  'access-control-allow-headers': 'content-type,x-business-id',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-max-age': '86400',
};

function parseBody(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) return undefined;
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  if (!raw.trim()) return undefined;
  return JSON.parse(raw) as unknown;
}

export async function handler(
  event: APIGatewayProxyEventV2,
  context?: Context,
): Promise<APIGatewayProxyStructuredResultV2> {
  const method = event.requestContext?.http?.method ?? 'GET';
  const path = event.rawPath ?? '/';
  const started = Date.now();

  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };

  let body: unknown;
  try {
    body = parseBody(event);
  } catch {
    return {
      statusCode: 400,
      headers: { 'content-type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({
        error: { code: 'MALFORMED_JSON', message: 'Request body was not valid JSON.', field: null, details: null },
      }),
    };
  }

  const req: RouterRequest = {
    method,
    path,
    query: (event.queryStringParameters ?? {}) as Record<string, string | string[]>,
    headers: (event.headers ?? {}) as Record<string, string | undefined>,
    body,
  };

  const res = await handle(req);

  // One structured log line per request - docs/05 § 10. Never log request bodies.
  console.log(
    JSON.stringify({
      level: res.status >= 500 ? 'error' : 'info',
      requestId: context?.awsRequestId ?? event.requestContext?.requestId,
      method,
      path,
      businessId: req.headers['x-business-id'] ?? null,
      status: res.status,
      durationMs: Date.now() - started,
    }),
  );

  return {
    statusCode: res.status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS, ...res.headers },
    body: JSON.stringify(res.body),
  };
}
