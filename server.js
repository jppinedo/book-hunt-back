require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5001; // Use the port provided by Vercel or default to 5000

// Enable CORS
app.use(
  cors({
    origin: 'http://localhost:5173', // Allow requests from your local frontend
    methods: ['GET', 'POST'], // Allow specific HTTP methods
    credentials: true, // Allow cookies and credentials
  })
);

// Token caching
let ebayToken = null;
let tokenExpiry = null;


// Function to get eBay token
const getEbayToken = async () => {
  if (ebayToken && tokenExpiry > Date.now()) {
    return ebayToken; // Return cached token if it's still valid
  }

  const clientId = process.env.EBAY_CLIENT_ID; // From environment variables
  const clientSecret = process.env.EBAY_CLIENT_SECRET; // From environment variables

  try {
    const response = await axios.post(
      'https://api.ebay.com/identity/v1/oauth2/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: clientId,
          password: clientSecret,
        },
      }
    );

    // Cache the token and set expiry (2 hours from now)
    ebayToken = response.data.access_token;
    tokenExpiry = Date.now() + response.data.expires_in * 1000;

    return ebayToken;
  } catch (error) {
    console.error('Error fetching eBay token:', error.response?.data || error.message);
    throw error;
  }
};

app.options('/api/ebay/search', cors());

// Proxy endpoint for eBay search
app.get('/api/ebay/search', async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  console.log(query);

  try {
    // Get eBay token (cached or new)
    const token = await getEbayToken();

    // Search eBay
    const searchResponse = await axios.get(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&category_ids=267`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    res.json(searchResponse.data);
  } catch (error) {
    console.error('Error searching eBay:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to search eBay' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});