// Script to sync all Firestore products to Elasticsearch
// Requirements: npm install @elastic/elasticsearch firebase-admin

const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH env variable required');
const serviceAccount = require(serviceAccountPath);
// --- CONFIG ---
// Initialize Firebase Admin with service account
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = getFirestore();

async function fetchAllFirestoreProducts(collectionRef) {
  let lastDoc = null;
  let allDocs = [];
  const pageSize = 1000;
  while (true) {
    let query = collectionRef.orderBy('__name__').limit(pageSize);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snapshot = await query.get();
    if (snapshot.empty) break;
    allDocs = allDocs.concat(snapshot.docs);
    if (snapshot.docs.length < pageSize) break;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }
  return allDocs;
}

async function syncAllProducts() {
  // 1. Fetch all Firestore products
  const collectionRef = db.collection('products');
  // Placeholder for Algolia sync logic
  async function syncAllProducts() {
    const collectionRef = db.collection('products');
    const docs = await fetchAllFirestoreProducts(collectionRef);
    console.log(`Fetched ${docs.length} products from Firestore.`);
    // TODO: Add Algolia sync logic here
  }
