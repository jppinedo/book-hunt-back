require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5001; // Use the port provided by the host or default to 5001

// ---------------------------------------------------------------------------
// eBay environment: EBAY_ENV=sandbox|production (default: sandbox).
// Both the OAuth token endpoint and the Browse API live on the same host.
// ---------------------------------------------------------------------------
const EBAY_ENV =
  (process.env.EBAY_ENV || 'sandbox').toLowerCase() === 'production'
    ? 'production'
    : 'sandbox';
const EBAY_API_HOST =
  EBAY_ENV === 'production'
    ? 'https://api.ebay.com'
    : 'https://api.sandbox.ebay.com';

const HTTP_TIMEOUT_MS = 10000; // 10s on every upstream eBay call

// ---------------------------------------------------------------------------
// CORS: ALLOWED_ORIGINS is a comma-separated list of origins
// (default: http://localhost:5173 for local front-end development).
// ---------------------------------------------------------------------------
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true, // Allow cookies and credentials
  })
);

// ---------------------------------------------------------------------------
// Credential check: endpoints fail fast with a clean 503 naming the missing
// configuration instead of surfacing a generic 500 from a doomed token call.
// ---------------------------------------------------------------------------
const missingConfig = () => {
  const missing = [];
  if (!process.env.EBAY_CLIENT_ID) missing.push('EBAY_CLIENT_ID');
  if (!process.env.EBAY_CLIENT_SECRET) missing.push('EBAY_CLIENT_SECRET');
  return missing;
};

const requireEbayConfig = (req, res, next) => {
  const missing = missingConfig();
  if (missing.length > 0) {
    return res.status(503).json({
      error: `eBay backend is not configured: missing ${missing.join(', ')}`,
      missing,
    });
  }
  next();
};

// ---------------------------------------------------------------------------
// Token caching (with a 60-second safety margin before the stated expiry)
// ---------------------------------------------------------------------------
let ebayToken = null;
let tokenExpiry = 0;

const getEbayToken = async () => {
  if (ebayToken && tokenExpiry > Date.now()) {
    return ebayToken; // Return cached token if it's still valid
  }

  const response = await axios.post(
    `${EBAY_API_HOST}/identity/v1/oauth2/token`,
    new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      auth: {
        username: process.env.EBAY_CLIENT_ID,
        password: process.env.EBAY_CLIENT_SECRET,
      },
      timeout: HTTP_TIMEOUT_MS,
    }
  );

  // Cache the token, expiring it slightly early as a safety margin
  ebayToken = response.data.access_token;
  const ttlMs = (response.data.expires_in || 7200) * 1000;
  tokenExpiry = Date.now() + Math.max(ttlMs - 60000, 0);

  return ebayToken;
};

// ---------------------------------------------------------------------------
// Upstream error handling: pass eBay's HTTP status through with a clean
// message (eBay's first error message when present); timeouts → 504,
// unreachable upstream → 502. Never dumps raw upstream payloads/headers.
// ---------------------------------------------------------------------------
const handleEbayError = (res, error, fallbackMessage) => {
  if (error.response) {
    const status = error.response.status;
    const upstreamErrors = error.response.data && error.response.data.errors;
    const detail =
      Array.isArray(upstreamErrors) && upstreamErrors[0] && upstreamErrors[0].message
        ? upstreamErrors[0].message
        : fallbackMessage;
    console.error(`eBay upstream error (${status}):`, detail);
    return res.status(status).json({ error: detail });
  }
  if (error.code === 'ECONNABORTED') {
    console.error('eBay request timed out');
    return res.status(504).json({ error: 'eBay request timed out' });
  }
  console.error('eBay request failed:', error.message);
  return res.status(502).json({ error: fallbackMessage });
};

// Health check
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    ebayConfigured: missingConfig().length === 0,
    env: EBAY_ENV,
  });
});

// Endpoint to fetch a single item by ID
app.get('/api/ebay/item/:itemId', requireEbayConfig, async (req, res) => {
  const { itemId } = req.params;

  if (!itemId) {
    return res.status(400).json({ error: 'Item ID is required' });
  }

  try {
    // Get eBay token (cached or new)
    const token = await getEbayToken();
    // Make a request to the eBay API
    const response = await axios.get(
      `${EBAY_API_HOST}/buy/browse/v1/item/${encodeURIComponent(itemId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: HTTP_TIMEOUT_MS,
      }
    );

    // Return the item data
    res.json(response.data);
  } catch (error) {
    handleEbayError(res, error, 'Failed to fetch item from eBay');
  }
});

// Proxy endpoint for eBay search
app.get('/api/ebay/search', requireEbayConfig, async (req, res) => {
  const { query, limit, offset } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    // Get eBay token (cached or new)
    const token = await getEbayToken();

    // Search eBay (limit/offset are omitted entirely when not provided —
    // the previous version interpolated them as "limit=undefined")
    const params = { q: query, category_ids: '267' }; // 267 = Books category
    if (limit !== undefined) params.limit = limit;
    if (offset !== undefined) params.offset = offset;

    const searchResponse = await axios.get(
      `${EBAY_API_HOST}/buy/browse/v1/item_summary/search`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
        timeout: HTTP_TIMEOUT_MS,
      }
    );

    res.json(searchResponse.data);
  } catch (error) {
    handleEbayError(res, error, 'Failed to search eBay');
  }
});

// Export the app so a serverless runtime (Vercel's @vercel/node builder)
// can import it and serve it as a function without it listening on a port.
module.exports = app;

// Start the server only when run directly (`npm start` / `node server.js`)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `Backend server running on http://localhost:${PORT} (eBay env: ${EBAY_ENV}, configured: ${missingConfig().length === 0})`
    );
  });
}
