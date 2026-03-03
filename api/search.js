import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL;
  const ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_API_KEY;
  const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX;

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
    res.status(200).json(esRes.data);
  } catch (err) {
    res.status(500).json({ error: 'Elasticsearch search failed', details: err.message });
  }
}
