import { promises as fs } from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import { Client } from '@elastic/elasticsearch';

let firebaseInitialized = false;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Load service account JSON
  const serviceAccountPath = path.join(process.cwd(), 'harga-modal-firebase-adminsdk-fbsvc-9999863e3d.json');
  let serviceAccount;
  try {
    const file = await fs.readFile(serviceAccountPath, 'utf8');
    serviceAccount = JSON.parse(file);
  } catch (err) {
    return res.status(500).json({ error: 'Service account file not found', details: err.message });
  }

  // Initialize Firebase Admin if not already
  if (!firebaseInitialized) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseInitialized = true;
  }
  const db = admin.firestore();

  // Initialize Elasticsearch client
  const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL;
  const ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_API_KEY;
  const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || 'products';
  const client = new Client({
    node: ELASTICSEARCH_URL,
    auth: { apiKey: ELASTICSEARCH_API_KEY },
    tls: { rejectUnauthorized: false },
  });

  try {
    // Fetch all products from Firestore
    const snapshot = await db.collection('products').get();
    const firestoreIds = new Set();
    const bulkOps = [];
    snapshot.forEach(doc => {
      firestoreIds.add(doc.id);
      const data = doc.data();
      bulkOps.push({ index: { _index: ELASTICSEARCH_INDEX, _id: doc.id } });
      const hargaModal = data.costPrice ?? '';
      const srp = data.srpPrice ?? '';
      let profit = '';
      if (typeof hargaModal === 'number' && typeof srp === 'number') {
        profit = srp - hargaModal;
      } else if (!isNaN(Number(hargaModal)) && !isNaN(Number(srp))) {
        profit = Number(srp) - Number(hargaModal);
      }
      bulkOps.push({
        name: data.name || '',
        brand: data.brand || '',
        hargaModal,
        srp,
        profit,
      });
    });
    // Fetch all product IDs from Elasticsearch
    const esIds = [];
    let esScrollId = null;
    let totalHits = 0;
    do {
      const esRes = await client.search({
        index: ELASTICSEARCH_INDEX,
        scroll: '1m',
        size: 1000,
        body: { query: { match_all: {} } }
      });
      totalHits = esRes.body.hits.total.value || esRes.body.hits.total;
      esRes.body.hits.hits.forEach(hit => esIds.push(hit._id));
      esScrollId = esRes.body._scroll_id;
      if (esRes.body.hits.hits.length < 1000) break;
    } while (esIds.length < totalHits && esScrollId);

    // Find IDs to delete from Elasticsearch
    const idsToDelete = esIds.filter(id => !firestoreIds.has(id));
    idsToDelete.forEach(id => {
      bulkOps.push({ delete: { _index: ELASTICSEARCH_INDEX, _id: id } });
    });

    if (bulkOps.length === 0) {
      return res.status(200).json({ success: true, message: 'No products found.' });
    }
    // Bulk update Elasticsearch (upsert + delete)
    const esBulkRes = await client.bulk({ refresh: true, body: bulkOps });
    if (esBulkRes.errors) {
      return res.status(500).json({ error: 'Some errors occurred during bulk upload', details: esBulkRes });
    }
    res.status(200).json({ success: true, synced: snapshot.size, deleted: idsToDelete.length });
  } catch (err) {
    res.status(500).json({ error: 'Sync failed', details: err.message });
  }
}
