/**
 * Local dev server. A thin node:http wrapper that builds the same API Gateway
 * v2 event the deployed Lambda receives and calls the identical handler - so
 * there is no second code path and local behaviour cannot drift from deployed.
 *
 * OWNER: M2  (docs/08-TEAM-ROLES.md § 3)
 * Usage: npm run dev:api   ->   http://localhost:3001/v1/health
 */
import { createServer } from 'node:http';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from '../index.js';

const PORT = Number(process.env.PORT ?? 3001);

const server = createServer((nodeReq, nodeRes) => {
  const chunks: Buffer[] = [];
  nodeReq.on('data', (c: Buffer) => chunks.push(c));
  nodeReq.on('end', () => {
    void (async () => {
      const url = new URL(nodeReq.url ?? '/', `http://localhost:${PORT}`);
      const query: Record<string, string> = {};
      for (const [k, v] of url.searchParams) {
        // API Gateway v2 joins repeated params with a comma; mirror that here
        query[k] = k in query ? `${query[k]},${v}` : v;
      }

      const event = {
        version: '2.0',
        rawPath: url.pathname,
        rawQueryString: url.search.replace(/^\?/, ''),
        headers: nodeReq.headers as Record<string, string>,
        queryStringParameters: query,
        requestContext: {
          requestId: `local-${Date.now()}`,
          http: { method: nodeReq.method ?? 'GET', path: url.pathname },
        },
        body: chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined,
        isBase64Encoded: false,
      } as unknown as APIGatewayProxyEventV2;

      const res = await handler(event);
      nodeRes.writeHead(res.statusCode ?? 200, res.headers as Record<string, string>);
      nodeRes.end(res.body ?? '');
    })();
  });
});

server.listen(PORT, () => {
  console.log(`[api] http://localhost:${PORT}/v1/health  (REPO_DRIVER=${process.env.REPO_DRIVER ?? 'memory'})`);
});
