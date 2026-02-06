import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// In-memory request queue
// ---------------------------------------------------------------------------

interface ShaderRequest {
  id: string;
  prompt: string;
  name?: string;
  status: 'pending' | 'completed';
  code?: string;
  createdAt: number;
}

const requests = new Map<string, ShaderRequest>();

// ---------------------------------------------------------------------------
// MCP Server (stdio transport — used by Claude Code)
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'shadermmaker',
  version: '1.0.0',
});

server.tool(
  'get_pending_requests',
  'Returns all pending shader generation requests submitted by users via the web app. Each request has an id and a natural-language prompt describing the desired shader effect.',
  async () => {
    const pending = [...requests.values()].filter(r => r.status === 'pending');
    if (pending.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No pending requests.' }] };
    }
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(pending, null, 2),
      }],
    };
  },
);

server.tool(
  'submit_shader',
  `Submit generated GLSL ES 3.00 fragment shader code for a pending request.
The code MUST:
  - Start with \`#version 300 es\` and \`precision highp float;\`
  - Declare \`out vec4 fragColor;\`
  - Include at minimum \`uniform vec2 u_resolution;\` and \`uniform float u_time;\`
  - Optionally include \`uniform vec2 u_mouse;\` and custom uniforms with range comments`,
  {
    requestId: z.string().describe('The request ID to fulfill'),
    code: z.string().describe('The generated GLSL ES 3.00 fragment shader code'),
    name: z.string().optional().describe('A short descriptive name for the shader'),
  },
  async ({ requestId, code, name }) => {
    const req = requests.get(requestId);
    if (!req) {
      return {
        content: [{ type: 'text' as const, text: `Error: Request ${requestId} not found` }],
        isError: true,
      };
    }
    if (req.status !== 'pending') {
      return {
        content: [{ type: 'text' as const, text: `Error: Request ${requestId} already completed` }],
        isError: true,
      };
    }
    req.status = 'completed';
    req.code = code;
    if (name) req.name = name;
    console.error(`[mcp] Shader submitted for request ${requestId}`);
    return {
      content: [{ type: 'text' as const, text: `Shader submitted successfully for request ${requestId}` }],
    };
  },
);

// ---------------------------------------------------------------------------
// HTTP Server (port 3099 — used by the web app)
// ---------------------------------------------------------------------------

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // POST /api/request — web app submits a shader prompt
  if (method === 'POST' && url === '/api/request') {
    try {
      const body = JSON.parse(await readBody(req));
      const prompt = body.prompt?.trim();
      if (!prompt) {
        json(res, 400, { error: 'prompt is required' });
        return;
      }
      const id = randomUUID();
      requests.set(id, {
        id,
        prompt,
        name: body.name?.trim() || undefined,
        status: 'pending',
        createdAt: Date.now(),
      });
      console.error(`[http] New request ${id}: "${prompt.slice(0, 60)}..."`);
      json(res, 201, { id });
    } catch {
      json(res, 400, { error: 'Invalid JSON body' });
    }
    return;
  }

  // POST /api/submit — Claude Code submits a generated shader via HTTP
  if (method === 'POST' && url === '/api/submit') {
    try {
      const body = JSON.parse(await readBody(req));
      const { requestId, code, name } = body;
      if (!requestId || !code) {
        json(res, 400, { error: 'requestId and code are required' });
        return;
      }
      const req2 = requests.get(requestId);
      if (!req2) {
        json(res, 404, { error: 'Request not found' });
        return;
      }
      if (req2.status !== 'pending') {
        json(res, 400, { error: 'Request already completed' });
        return;
      }
      req2.status = 'completed';
      req2.code = code;
      if (name) req2.name = name;
      console.error(`[http] Shader submitted for request ${requestId}`);
      json(res, 200, { ok: true });
    } catch {
      json(res, 400, { error: 'Invalid JSON body' });
    }
    return;
  }

  // GET /api/pending — list pending requests (for Claude Code via HTTP)
  if (method === 'GET' && url === '/api/pending') {
    const pending = [...requests.values()].filter(r => r.status === 'pending');
    json(res, 200, pending);
    return;
  }

  // GET /api/result/:id — web app polls for result
  const resultMatch = url.match(/^\/api\/result\/([a-f0-9-]+)$/);
  if (method === 'GET' && resultMatch) {
    const id = resultMatch[1];
    const req2 = requests.get(id);
    if (!req2) {
      json(res, 404, { error: 'Request not found' });
      return;
    }
    if (req2.status === 'pending') {
      json(res, 200, { status: 'pending' });
    } else {
      json(res, 200, { status: 'completed', code: req2.code, name: req2.name });
    }
    return;
  }

  // Health check
  if (method === 'GET' && url === '/health') {
    json(res, 200, { ok: true, pending: [...requests.values()].filter(r => r.status === 'pending').length });
    return;
  }

  json(res, 404, { error: 'Not found' });
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

const HTTP_PORT = 3099;

async function main() {
  const httpServer = createServer(handleRequest);
  httpServer.listen(HTTP_PORT, () => {
    console.error(`[shadermmaker-mcp] HTTP server listening on http://localhost:${HTTP_PORT}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[shadermmaker-mcp] MCP server connected via stdio');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
