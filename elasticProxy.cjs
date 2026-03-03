const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'https://my-elasticsearch-project-c4a430.es.asia-southeast1.gcp.elastic.cloud:443';
const ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_API_KEY || 'UkdsRGpwd0J3NHBLZ2VtOHJUdTA6OHJ4ZWJzTEpKV2czeDAwWTFTcy0tUQ==';
const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || 'products';

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