const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL;
const ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_API_KEY;
const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX;

app.post('/api/search', async (req, res) => {
  try {
    const searchBody = req.body;
    const esRes = await axios.post(
      `${ELASTICSEARCH_URL}/${ELASTICSEARCH_INDEX}/_search`,
      searchBody,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `ApiKey ${ELASTICSEARCH_API_KEY}`,
        },
      }
    );
    res.json(esRes.data);
  } catch (err) {
    res.status(500).json({ error: 'Elasticsearch search failed', details: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Elasticsearch proxy running on port ${PORT}`);
});