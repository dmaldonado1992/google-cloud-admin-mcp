import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

const SETUP_MODE = String(process.env.SETUP_MODE ?? 'true').toLowerCase() === 'true';
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
const PROJECT_ID = String(process.env.GOOGLE_CLOUD_PROJECT_ID || '').trim();
const OAUTH_CONFIGURED = Boolean(!SETUP_MODE && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_ALLOWED_EMAIL && PUBLIC_BASE_URL);

function content(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function createServer() {
  const server = new McpServer({ name: 'google-cloud-admin-mcp', version: '0.1.0' });
  server.tool('get_setup_status', 'Show MCP deployment and OAuth-bootstrap status. This tool never changes Google Cloud.', {}, async () => content({
    mode: SETUP_MODE ? 'public_setup' : 'oauth',
    projectIdConfigured: Boolean(PROJECT_ID),
    oauthConfigured: OAUTH_CONFIGURED,
    googleCloudOperationsEnabled: false,
    message: SETUP_MODE ? 'Public setup mode: no Google Cloud administrative operations are exposed.' : 'OAuth mode is reserved for the next release after OAuth validation.'
  }));
  server.tool('get_oauth_setup_instructions', 'Return the safe configuration checklist required before Google Cloud administrative tools can be enabled.', {}, async () => content({
    requiredRenderVariables: ['PUBLIC_BASE_URL', 'GOOGLE_CLOUD_PROJECT_ID', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_ALLOWED_EMAIL'],
    requiredGoogleOAuthRedirectUri: PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}/oauth/google/callback` : 'Set PUBLIC_BASE_URL first.',
    requiredScopes: ['https://www.googleapis.com/auth/cloud-platform'],
    safety: 'OAuth is required before enabling tools that read or modify Google Cloud resources.'
  }));
  return server;
}

async function handleMcp(req, res) {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    Promise.resolve(transport.close()).catch(() => {});
    Promise.resolve(server.close()).catch(() => {});
  };
  res.once('finish', close);
  res.once('close', close);
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

app.post('/mcp', async (req, res) => {
  try {
    await handleMcp(req, res);
  } catch (error) {
    console.error('MCP request failed:', error);
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: String(error?.message || error) }, id: req.body?.id ?? null });
  }
});
app.get('/mcp', (_req, res) => res.status(405).set('Allow', 'POST').json({ error: 'Use POST /mcp.' }));
app.get('/health', (_req, res) => res.json({
  ok: true, service: 'google-cloud-admin-mcp', mode: SETUP_MODE ? 'public_setup' : 'oauth',
  projectIdConfigured: Boolean(PROJECT_ID), oauthConfigured: OAUTH_CONFIGURED, googleCloudOperationsEnabled: false
}));
app.use((error, _req, res, next) => error instanceof SyntaxError && 'body' in error ? res.status(400).json({ error: 'Invalid JSON body' }) : next(error));

const port = Number(process.env.PORT || 10000);
app.listen(port, '0.0.0.0', () => console.log(`google-cloud-admin-mcp listening on ${port} (${SETUP_MODE ? 'public setup' : 'oauth'} mode)`));
