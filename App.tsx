import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { UploadView } from './components/UploadView';
import { MappingModal } from './components/MappingModal';
import { InventoryView } from './components/InventoryView';
import { DashboardView } from './components/DashboardView';
import { AppView, Product, RawExtractionItem, ColumnMapping, BrandNote } from './types';
import { db } from './firebaseConfig';
import { 
  collection, 
  getDoc,
  getDocs,
  getCountFromServer,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  writeBatch,
  serverTimestamp,
  query,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentSnapshot,
  DocumentData,
  Timestamp,
  where,
} from 'firebase/firestore';

const App: React.FC = () => {
  const PAGE_SIZE = 50;

  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [totalProducts, setTotalProducts] = useState(0);
  const [dashboardTotalProducts, setDashboardTotalProducts] = useState(0);
  const [dashboardTotalValue, setDashboardTotalValue] = useState(0);
  const [dashboardBrandCounts, setDashboardBrandCounts] = useState<Record<string, number>>({});
  const [deleteBrandProgress, setDeleteBrandProgress] = useState<{
    brandName: string;
    processed: number;
    total: number;
  } | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastDocByPage, setLastDocByPage] = useState<(DocumentSnapshot<DocumentData> | null)[]>([null]);
  const [activeBrandFilter, setActiveBrandFilter] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [brandNotes, setBrandNotes] = useState<BrandNote[]>([]);
  
  // Staging state for upload process
  const [extractedData, setExtractedData] = useState<RawExtractionItem[]>([]);
  const [showMappingModal, setShowMappingModal] = useState(false);

  const buildSearchKeywords = (name: string, brand: string): string[] => {
    const source = `${name || ''} ${brand || ''}`.toLowerCase();
    const cleaned = source.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) return [];

    const words = cleaned.split(' ').filter(Boolean);
    const keywordSet = new Set<string>();

    words.forEach((word) => {
      keywordSet.add(word);
      for (let i = 2; i <= word.length; i++) {
        keywordSet.add(word.slice(0, i));
      }
    });

    return Array.from(keywordSet).slice(0, 150);
  };

  const buildQueryTokens = (queryText: string): string[] => {
    const normalized = queryText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) return [];

    const words = normalized.split(' ').filter(Boolean);
    const tokens = new Set<string>();

    words.forEach((word) => {
      if (word.length === 1) {
        tokens.add(word);
        return;
      }

      tokens.add(word);
      for (let i = 2; i <= word.length; i++) {
        tokens.add(word.slice(0, i));
      }
    });

    return Array.from(tokens).slice(0, 10);
  };

  const getPrimarySearchToken = (queryText: string): string => {
    const normalized = queryText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    const words = normalized.split(' ').filter(w => w.length >= 2);
    return words[0] || '';
  };

  const backfillSearchKeywordsIfNeeded = async () => {
    const migrationKey = 'searchKeywordsMigrationV1';
    if (window.localStorage.getItem(migrationKey) === 'done') return;

    const allSnapshot = await getDocs(collection(db, 'products'));
    if (allSnapshot.empty) {
      window.localStorage.setItem(migrationKey, 'done');
      return;
    }

    let batch = writeBatch(db);
    let operationCount = 0;
    const MAX_BATCH_SIZE = 400;

    for (const itemDoc of allSnapshot.docs) {
      const data = itemDoc.data();
      const name = typeof data.name === 'string' ? data.name : '';
      const brand = typeof data.brand === 'string' ? data.brand : '';
      const searchKeywords = buildSearchKeywords(name, brand);

      batch.update(doc(db, 'products', itemDoc.id), { searchKeywords });
      operationCount++;

      if (operationCount >= MAX_BATCH_SIZE) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }

    window.localStorage.setItem(migrationKey, 'done');
  };

  const backfillSrpPriceIfNeeded = async () => {
    const migrationKey = 'srpPriceMigrationV1';
    if (window.localStorage.getItem(migrationKey) === 'done') return;

    const allSnapshot = await getDocs(collection(db, 'products'));
    if (allSnapshot.empty) {
      window.localStorage.setItem(migrationKey, 'done');
      return;
    }

    let batch = writeBatch(db);
    let operationCount = 0;
    const MAX_BATCH_SIZE = 400;

    for (const itemDoc of allSnapshot.docs) {
      const data = itemDoc.data();
      // Only update products that don't have srpPrice field set
      if (data.srpPrice === undefined || data.srpPrice === null) {
        batch.update(doc(db, 'products', itemDoc.id), { srpPrice: 0 });
        operationCount++;

        if (operationCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
        }
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }

    window.localStorage.setItem(migrationKey, 'done');
  };

  const mapDocToProduct = (itemDoc: QueryDocumentSnapshot<DocumentData>): Product => {
    const data = itemDoc.data();
    const lastUpdated = data.lastUpdated;
    let normalizedLastUpdated = '';

    if (lastUpdated instanceof Timestamp) {
      normalizedLastUpdated = lastUpdated.toDate().toISOString();
    } else if (typeof lastUpdated === 'string') {
      normalizedLastUpdated = lastUpdated;
    }

    return {
      id: itemDoc.id,
      name: data.name,
      brand: data.brand,
      costPrice: data.costPrice || 0,
      srpPrice: data.srpPrice || 0,
      lastUpdated: normalizedLastUpdated,
      rawJson: data.rawJson,
    } as Product;
  };

  const buildProductsQuery = (brandFilter: string | null, keyword: string) => {
    const productsRef = collection(db, 'products');
    const primaryToken = getPrimarySearchToken(keyword);

    if (brandFilter && primaryToken) {
      return query(
        productsRef,
        where('brand', '==', brandFilter),
        where('searchKeywords', 'array-contains', primaryToken),
        orderBy('name'),
      );
    }

    if (brandFilter) {
      return query(productsRef, where('brand', '==', brandFilter), orderBy('name'));
    }

    if (primaryToken) {
      return query(
        productsRef,
        where('searchKeywords', 'array-contains', primaryToken),
        orderBy('name'),
      );
    }

    return query(productsRef, orderBy('name'));
  };

  const clientSideFilter = (productList: Product[], keyword: string): Product[] => {
    if (!keyword.trim()) return productList;

    const searchLower = keyword.toLowerCase();
    return productList.filter((product) => {
      const nameLower = product.name.toLowerCase();
      const brandLower = product.brand.toLowerCase();
      return nameLower.includes(searchLower) || brandLower.includes(searchLower);
    });
  };

  const normalizeBrand = (value?: string | null): string => {
    const normalized = (value || 'Unknown').trim().toLowerCase();
    return normalized || 'unknown';
  };

  const formatBrandName = (value?: string | null): string => {
    const compacted = (value || '').trim().replace(/\s+/g, ' ');
    return compacted ? compacted.toUpperCase() : 'UNKNOWN';
  };

  const matchesFilters = (product: Product, brandFilter: string | null, keyword: string): boolean => {
    const trimmedKeyword = keyword.trim();
    const normalizedFilter = brandFilter ? normalizeBrand(brandFilter) : '';
    const normalizedProductBrand = normalizeBrand(product.brand);

    if (normalizedFilter && normalizedProductBrand !== normalizedFilter) {
      return false;
    }

    if (!trimmedKeyword) return true;

    const searchLower = trimmedKeyword.toLowerCase();
    return product.name.toLowerCase().includes(searchLower) || normalizedProductBrand.includes(searchLower);
  };

  const refreshTotalCount = async (brandFilter: string | null, keyword: string) => {
    try {
      if (keyword.trim()) {
        // For search, we need to fetch and count client-side
        const baseQuery = brandFilter
          ? query(collection(db, 'products'), where('brand', '==', brandFilter))
          : collection(db, 'products');
        const snapshot = await getDocs(baseQuery);
        const allProducts = snapshot.docs.map(mapDocToProduct);
        const filtered = clientSideFilter(allProducts, keyword);
        setTotalProducts(filtered.length);
      } else {
        const baseQuery = brandFilter
          ? query(collection(db, 'products'), where('brand', '==', brandFilter))
          : collection(db, 'products');
        const countSnapshot = await getCountFromServer(baseQuery);
        setTotalProducts(countSnapshot.data().count);
      }
    } catch (error) {
      console.error('Error counting products:', error);
      setTotalProducts(0);
    }
  };

  const refreshDashboardStats = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'products'));
      let totalValue = 0;
      const brandCounts: Record<string, number> = {};

      snapshot.docs.forEach((itemDoc) => {
        const data = itemDoc.data();
        const cost = typeof data.costPrice === 'number' ? data.costPrice : Number(data.costPrice) || 0;
        const brand = typeof data.brand === 'string' ? data.brand.trim() : 'Unknown';
        const normalizedBrand = brand || 'Unknown';
        totalValue += cost;
        brandCounts[normalizedBrand] = (brandCounts[normalizedBrand] || 0) + 1;
      });

      setDashboardTotalProducts(snapshot.size);
      setDashboardTotalValue(totalValue);
      setDashboardBrandCounts(brandCounts);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setDashboardTotalProducts(0);
      setDashboardTotalValue(0);
      setDashboardBrandCounts({});
    }
  };

  const fetchPage = async (
    cursor: QueryDocumentSnapshot<DocumentData> | null,
    pageNumber: number,
    brandFilter: string | null,
    keyword: string,
  ) => {
    setIsPageLoading(true);
    try {
      const trimmedKeyword = keyword.trim();
      const hasFilters = Boolean(trimmedKeyword) || Boolean(brandFilter?.trim());
      const baseQuery = query(collection(db, 'products'), orderBy('name'));

      if (!hasFilters) {
        const pageQuery = cursor
          ? query(baseQuery, startAfter(cursor), limit(PAGE_SIZE + 1))
          : query(baseQuery, limit(PAGE_SIZE + 1));

        const snapshot = await getDocs(pageQuery);
        const docs = snapshot.docs;
        const pageDocs = docs.slice(0, PAGE_SIZE).map(mapDocToProduct);
        const nextPageExists = docs.length > PAGE_SIZE;

        setProducts(pageDocs);
        setHasNextPage(nextPageExists);
        setCurrentPage(pageNumber);

        const lastVisible = docs[Math.min(PAGE_SIZE - 1, docs.length - 1)] || null;
        setLastDocByPage(prev => {
          const next = [...prev];
          next[pageNumber] = lastVisible;
          return next;
        });
        return;
      }

      const SEARCH_BATCH_SIZE = 200;
      const matched: { product: Product; doc: QueryDocumentSnapshot<DocumentData> }[] = [];
      let lastScannedDoc: QueryDocumentSnapshot<DocumentData> | null = cursor;
      let hasMoreDocs = true;

      while (matched.length < PAGE_SIZE + 1 && hasMoreDocs) {
        const pageQuery = lastScannedDoc
          ? query(baseQuery, startAfter(lastScannedDoc), limit(SEARCH_BATCH_SIZE))
          : query(baseQuery, limit(SEARCH_BATCH_SIZE));

        const snapshot = await getDocs(pageQuery);
        const docs = snapshot.docs;

        if (docs.length === 0) {
          hasMoreDocs = false;
          break;
        }

        for (const itemDoc of docs) {
          const product = mapDocToProduct(itemDoc);
          if (matchesFilters(product, brandFilter, trimmedKeyword)) {
            matched.push({ product, doc: itemDoc });
            if (matched.length >= PAGE_SIZE + 1) break;
          }
        }

        lastScannedDoc = docs[docs.length - 1];
        if (docs.length < SEARCH_BATCH_SIZE) {
          hasMoreDocs = false;
        }
      }

      const pageMatches = matched.slice(0, PAGE_SIZE);
      setProducts(pageMatches.map(item => item.product));
      setHasNextPage(matched.length > PAGE_SIZE);
      setCurrentPage(pageNumber);

      const lastMatchedDoc = pageMatches.length > 0 ? pageMatches[pageMatches.length - 1].doc : null;
      setLastDocByPage(prev => {
        const next = [...prev];
        next[pageNumber] = lastMatchedDoc;
        return next;
      });
    } finally {
      setIsLoading(false);
      setIsPageLoading(false);
    }
  };

  // --------------------------------------------------------
  // 1. Initial Firestore Page + Total Count
  // --------------------------------------------------------
  useEffect(() => {
    backfillSearchKeywordsIfNeeded().catch((error) => {
      console.error('Search keyword migration failed:', error);
    });
    backfillSrpPriceIfNeeded().catch((error) => {
      console.error('SRP price migration failed:', error);
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setLastDocByPage([null]);
        setCurrentPage(1);
        await Promise.all([
          refreshTotalCount(activeBrandFilter, searchTerm),
          refreshDashboardStats(),
          fetchPage(null, 1, activeBrandFilter, searchTerm),
          fetchBrandNotes(),
        ]);
      } catch (error) {
        console.error('Error loading products:', error);
        setIsLoading(false);
      }
    };

    load();
  }, [activeBrandFilter, searchTerm]);

  const handleNextPage = async () => {
    if (!hasNextPage) return;
    let cursorForNext = lastDocByPage[currentPage] || null;

    if (!cursorForNext && products.length > 0) {
      try {
        const lastProductId = products[products.length - 1].id;
        const lastDocSnapshot = await getDoc(doc(db, 'products', lastProductId));
        if (lastDocSnapshot.exists()) {
          cursorForNext = lastDocSnapshot;
        }
      } catch (error) {
        console.error('Failed to recover pagination cursor:', error);
      }
    }

    if (!cursorForNext) return;
    await fetchPage(cursorForNext, currentPage + 1, activeBrandFilter, searchTerm);
  };

  const handlePrevPage = async () => {
    if (currentPage <= 1) return;
    const prevPageNumber = currentPage - 1;
    const cursorForPrev = lastDocByPage[prevPageNumber - 1] || null;
    await fetchPage(cursorForPrev, prevPageNumber, activeBrandFilter, searchTerm);
  };

  const refreshCurrentPage = async () => {
    const cursor = lastDocByPage[currentPage - 1] || null;
    await Promise.all([
      fetchPage(cursor, currentPage, activeBrandFilter, searchTerm),
      refreshTotalCount(activeBrandFilter, searchTerm),
      refreshDashboardStats(),
    ]);
  };

  const handleBrandFromDashboard = (brand: string) => {
    setSearchInput('');
    setSearchTerm('');
    setLastDocByPage([null]);
    setCurrentPage(1);
    setActiveBrandFilter(brand);
    setCurrentView(AppView.INVENTORY);
  };

  const handleClearBrandFilter = () => {
    setLastDocByPage([null]);
    setCurrentPage(1);
    setActiveBrandFilter(null);
  };

  const handleSearchInputChange = (value: string) => {
    setSearchInput(value);
  };

  const handleSearchSubmit = () => {
    setSearchTerm(searchInput.trim());
  };

  const isSearching = isPageLoading && searchTerm.trim().length > 0;

  // --------------------------------------------------------
  // Brand Notes Operations
  // --------------------------------------------------------
  const fetchBrandNotes = async () => {
    try {
      const notesSnapshot = await getDocs(collection(db, 'brandNotes'));
      const notes: BrandNote[] = notesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          brandName: data.brandName,
          note: data.note,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt || '',
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt || '',
        };
      });
      setBrandNotes(notes);
    } catch (e) {
      console.error('Error fetching brand notes:', e);
    }
  };

  const handleAddBrandNote = async (brandName: string, note: string) => {
    try {
      const formattedBrandName = formatBrandName(brandName);
      // Check if note already exists for this brand
      const normalizedTarget = normalizeBrand(formattedBrandName);
      const existing = brandNotes.find(bn => normalizeBrand(bn.brandName) === normalizedTarget);
      if (existing) {
        await updateDoc(doc(db, 'brandNotes', existing.id), {
          note,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'brandNotes'), {
          brandName: formattedBrandName,
          note,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await fetchBrandNotes();
    } catch (e) {
      console.error('Error adding brand note:', e);
      alert('Failed to save brand note.');
    }
  };

  const handleUpdateBrandNote = async (noteId: string, note: string) => {
    try {
      await updateDoc(doc(db, 'brandNotes', noteId), {
        note,
        updatedAt: serverTimestamp(),
      });
      await fetchBrandNotes();
    } catch (e) {
      console.error('Error updating brand note:', e);
      alert('Failed to update brand note.');
    }
  };

  const handleDeleteBrandNote = async (noteId: string) => {
    try {
      await deleteDoc(doc(db, 'brandNotes', noteId));
      await fetchBrandNotes();
    } catch (e) {
      console.error('Error deleting brand note:', e);
      alert('Failed to delete brand note.');
    }
  };

  const handleDeleteBrand = async (brandName: string) => {
    try {
      const normalizedTarget = normalizeBrand(brandName);
      const MAX_BATCH_SIZE = 450;

      const productsSnapshot = await getDocs(collection(db, 'products'));
      let batch = writeBatch(db);
      let operationCount = 0;

      for (const itemDoc of productsSnapshot.docs) {
        const data = itemDoc.data();
        const itemBrand = normalizeBrand(typeof data.brand === 'string' ? data.brand : '');
        if (itemBrand !== normalizedTarget) continue;

        batch.delete(doc(db, 'products', itemDoc.id));
        operationCount++;

        if (operationCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
        }
      }

      if (operationCount > 0) {
        await batch.commit();
      }

      const brandNotesSnapshot = await getDocs(collection(db, 'brandNotes'));
      const brandNotesToDelete = brandNotesSnapshot.docs.filter((noteDoc) => {
        const data = noteDoc.data();
        const noteBrand = normalizeBrand(typeof data.brandName === 'string' ? data.brandName : '');
        return noteBrand === normalizedTarget;
      });

      if (brandNotesToDelete.length > 0) {
        batch = writeBatch(db);
        operationCount = 0;

        for (const noteDoc of brandNotesToDelete) {
          batch.delete(doc(db, 'brandNotes', noteDoc.id));
          operationCount++;

          if (operationCount >= MAX_BATCH_SIZE) {
            await batch.commit();
            batch = writeBatch(db);
            operationCount = 0;
          }
        }

        if (operationCount > 0) {
          await batch.commit();
        }
      }

      if (activeBrandFilter && normalizeBrand(activeBrandFilter) === normalizedTarget) {
        setActiveBrandFilter(null);
        setSearchInput('');
        setSearchTerm('');
      }

      setLastDocByPage([null]);
      setCurrentPage(1);

      await Promise.all([
        fetchPage(null, 1, activeBrandFilter, searchTerm),
        refreshTotalCount(activeBrandFilter, searchTerm),
        refreshDashboardStats(),
        fetchBrandNotes(),
      ]);
    } catch (error) {
      console.error('Error deleting brand:', error);
      alert('Failed to delete brand and its products.');
    }
  };

  const handleAdjustBrandPrices = async (
    brandName: string,
    percentage: number,
    targetColumn: 'costPrice' | 'srpPrice'
  ) => {
    try {
      if (!Number.isFinite(percentage) || percentage === 0) {
        alert('Please enter a valid percentage.');
        return;
      }

      const targetLabel = targetColumn === 'costPrice' ? 'Base Price' : 'SRP Price';
      const actionLabel = percentage > 0 ? 'increase' : 'decrease';

      const confirmed = window.confirm(
        `Apply ${Math.abs(percentage)}% ${actionLabel} to ${targetLabel} for all products in brand ${brandName}?`
      );
      if (!confirmed) return;

      const normalizedTarget = normalizeBrand(brandName);
      const multiplier = 1 + (percentage / 100);
      const MAX_BATCH_SIZE = 450;

      const productsSnapshot = await getDocs(collection(db, 'products'));
      let batch = writeBatch(db);
      let operationCount = 0;
      let updatedCount = 0;

      for (const itemDoc of productsSnapshot.docs) {
        const data = itemDoc.data();
        const itemBrand = normalizeBrand(typeof data.brand === 'string' ? data.brand : '');
        if (itemBrand !== normalizedTarget) continue;

        const currentCost = typeof data.costPrice === 'number' ? data.costPrice : Number(data.costPrice) || 0;
        const currentSrp = typeof data.srpPrice === 'number' ? data.srpPrice : Number(data.srpPrice) || 0;

        const updates: { costPrice?: number; srpPrice?: number; lastUpdated: ReturnType<typeof serverTimestamp> } = {
          lastUpdated: serverTimestamp(),
        };

        if (targetColumn === 'costPrice') {
          updates.costPrice = Math.max(0, Math.round(currentCost * multiplier));
        } else {
          updates.srpPrice = Math.max(0, Math.round(currentSrp * multiplier));
        }

        batch.update(doc(db, 'products', itemDoc.id), updates);

        operationCount++;
        updatedCount++;

        if (operationCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
        }
      }

      if (operationCount > 0) {
        await batch.commit();
      }

      await refreshCurrentPage();
      alert(`Updated ${updatedCount} products for brand ${brandName} (${targetLabel}, ${percentage}%).`);
    } catch (error) {
      console.error('Error adjusting brand prices:', error);
      alert('Failed to adjust brand prices.');
    }
  };

  const handleExtractionComplete = (data: RawExtractionItem[]) => {
    setExtractedData(data);
    setShowMappingModal(true);
  };

  // --------------------------------------------------------
  // 2. Import Logic (Batch Upsert to Firestore)
  // --------------------------------------------------------
  const handleMappingConfirm = async (mapping: ColumnMapping) => {
    let batch = writeBatch(db);
    let operationCount = 0;
    const MAX_BATCH_SIZE = 450; // Firestore limit is 500

    const normalizeText = (val: unknown): string => {
      if (val === undefined || val === null) return '';
      const text = String(val).trim();
      if (!text) return '';
      if (/^(undefined|null|n\/a|na|-)$/i.test(text)) return '';
      return text;
    };

    const getBestValue = (
      item: RawExtractionItem,
      preferredKey: string,
      fallbackKeys: string[] = [],
      fallbackPattern?: RegExp,
    ): string => {
      const preferred = normalizeText(item[preferredKey]);
      if (preferred) return preferred;

      for (const key of fallbackKeys) {
        const value = normalizeText(item[key]);
        if (value) return value;
      }

      if (!fallbackPattern) return '';

      const fallbackKey = Object.keys(item).find((key) => fallbackPattern.test(key) && normalizeText(item[key]));
      return fallbackKey ? normalizeText(item[fallbackKey]) : '';
    };

    const formattedBrandName = formatBrandName(mapping.brandName);

    // Transform raw data
    const incomingItems = extractedData.map((item, index) => {
      const cleanPrice = (val: string | number) => {
        if (typeof val === 'number') return val;
        const str = String(val);
        const cleanStr = str.replace(/[^0-9]/g, '');
        return parseInt(cleanStr, 10) || 0;
      };

      const manualRetag = mapping.manualRetagByRow?.[index];

      const productName =
        normalizeText(manualRetag?.name) ||
        getBestValue(item, mapping.nameField, mapping.nameFallbackFields || [], /desc|name|product|item|model/i);

      const manualCost = manualRetag?.costPrice && manualRetag.costPrice > 0 ? manualRetag.costPrice : 0;
      const priceRaw =
        manualCost > 0
          ? manualCost
          : getBestValue(item, mapping.costField, mapping.costFallbackFields || [], /price|cost|dealer|net|wholesale/i);

      const manualSrp = manualRetag?.srpPrice && manualRetag.srpPrice > 0 ? manualRetag.srpPrice : 0;
      const srpRaw =
        manualSrp > 0
          ? manualSrp
          : mapping.srpField ? getBestValue(item, mapping.srpField, mapping.srpFallbackFields || [], /price|retail|sell|srp/i) : '0';

      return {
        name: productName,
        costPrice: manualCost > 0 ? manualCost : cleanPrice(priceRaw),
        srpPrice: manualSrp > 0 ? manualSrp : cleanPrice(srpRaw),
        brand: formattedBrandName,
        rawJson: item
      };
    }).filter(p => p.name && p.costPrice > 0);

    // Create a map of existing products for fast lookup (Case insensitive)
    // This is only fetched during import to avoid loading all products in normal browsing.
    const allProductsSnapshot = await getDocs(collection(db, 'products'));
    const existingProductMap = new Map<string, Product>();
    allProductsSnapshot.docs.forEach(itemDoc => {
      const data = itemDoc.data();
      const name = typeof data.name === 'string' ? data.name.toLowerCase().trim() : '';
      if (!name) return;
      existingProductMap.set(name, {
        id: itemDoc.id,
        name: data.name,
        brand: data.brand,
        costPrice: data.costPrice,
        lastUpdated: '',
      } as Product);
    });

    try {
      // Loop through incoming items and queue batch operations
      for (const newItem of incomingItems) {
        const key = newItem.name.toLowerCase().trim();
        const existingProduct = existingProductMap.get(key);

        if (existingProduct) {
          // UPDATE existing
          const ref = doc(db, 'products', existingProduct.id);
          batch.update(ref, {
            costPrice: newItem.costPrice,
            srpPrice: newItem.srpPrice || 0,
            brand: newItem.brand,
            lastUpdated: serverTimestamp(),
            rawJson: newItem.rawJson,
            searchKeywords: buildSearchKeywords(newItem.name, newItem.brand),
          });
        } else {
          // CREATE new
          const ref = doc(collection(db, 'products'));
          batch.set(ref, {
            name: newItem.name,
            costPrice: newItem.costPrice,
            srpPrice: newItem.srpPrice || 0,
            brand: newItem.brand,
            lastUpdated: serverTimestamp(),
            rawJson: newItem.rawJson,
            searchKeywords: buildSearchKeywords(newItem.name, newItem.brand),
          });
        }

        operationCount++;

        // Commit and reset if we hit the limit
        if (operationCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(db); // Create new batch for next set
          operationCount = 0;
        }
      }

      if (operationCount > 0) {
        await batch.commit();
        console.log(`Successfully processed batch.`);
      }

      // Ensure brand metadata exists
      const brandName = formattedBrandName;
      const existingBrandNote = brandNotes.find(bn => normalizeBrand(bn.brandName) === normalizeBrand(brandName));
      if (!existingBrandNote) {
        await addDoc(collection(db, 'brandNotes'), {
          brandName,
          note: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await fetchBrandNotes();
      }

      setShowMappingModal(false);
      setExtractedData([]);
      setCurrentView(AppView.INVENTORY);
      await refreshCurrentPage();

    } catch (e) {
      console.error("Batch update failed:", e);
      alert("Error saving data to Firebase. Check console.");
    }
  };

  // --------------------------------------------------------
  // 3. Single Product Operations (Firestore)
  // --------------------------------------------------------
  
  const handleAddProduct = async (newProductData: { name: string; brand: string; costPrice: number; srpPrice?: number }) => {
    try {
      const normalizedName = newProductData.name.trim();
      const formattedBrandName = formatBrandName(newProductData.brand);
      const duplicateCheckQuery = query(collection(db, 'products'), where('name', '==', normalizedName), limit(1));
      const duplicateCheckSnapshot = await getDocs(duplicateCheckQuery);
      const existingDoc = duplicateCheckSnapshot.docs[0];

      if (existingDoc) {
        // Update existing if name matches
        const ref = doc(db, 'products', existingDoc.id);
        await updateDoc(ref, {
          costPrice: newProductData.costPrice,
          srpPrice: newProductData.srpPrice || 0,
          brand: formattedBrandName,
          lastUpdated: serverTimestamp(),
          searchKeywords: buildSearchKeywords(newProductData.name, formattedBrandName),
        });
      } else {
        // Create new
        await addDoc(collection(db, 'products'), {
          name: newProductData.name,
          brand: formattedBrandName,
          costPrice: newProductData.costPrice,
          srpPrice: newProductData.srpPrice || 0,
          lastUpdated: serverTimestamp(),
          searchKeywords: buildSearchKeywords(newProductData.name, formattedBrandName),
        });
      }

      // Ensure brand metadata exists
      const brandName = formattedBrandName;
      const existingBrandNote = brandNotes.find(bn => normalizeBrand(bn.brandName) === normalizeBrand(brandName));
      if (!existingBrandNote) {
        await addDoc(collection(db, 'brandNotes'), {
          brandName,
          note: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await fetchBrandNotes();
      }

      await refreshCurrentPage();
    } catch (e) {
      console.error("Error adding product:", e);
      alert("Failed to add product.");
    }
  };

  const handleUpdateProduct = async (updated: Product) => {
    try {
      const formattedBrandName = formatBrandName(updated.brand);
      const ref = doc(db, 'products', updated.id);
      await updateDoc(ref, {
        name: updated.name,
        brand: formattedBrandName,
        costPrice: updated.costPrice,
        srpPrice: updated.srpPrice || 0,
        lastUpdated: serverTimestamp(),
        searchKeywords: buildSearchKeywords(updated.name, formattedBrandName),
      });
      await refreshCurrentPage();
    } catch (e) {
      console.error("Error updating product:", e);
      alert("Failed to update product.");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id));
      await refreshCurrentPage();
    } catch (e) {
      console.error("Error deleting product:", e);
      alert("Failed to delete product.");
    }
  };

  const handleDeleteAllProducts = async () => {
    try {
      const MAX_BATCH_SIZE = 450;
      let hasMore = true;

      while (hasMore) {
        const chunkQuery = query(collection(db, 'products'), orderBy('name'), limit(MAX_BATCH_SIZE));
        const chunkSnapshot = await getDocs(chunkQuery);

        if (chunkSnapshot.empty) {
          hasMore = false;
          continue;
        }

        const batch = writeBatch(db);
        chunkSnapshot.docs.forEach((itemDoc) => {
          batch.delete(doc(db, 'products', itemDoc.id));
        });

        await batch.commit();

        if (chunkSnapshot.size < MAX_BATCH_SIZE) {
          hasMore = false;
        }
      }

      setLastDocByPage([null]);
      await Promise.all([
        fetchPage(null, 1, activeBrandFilter, searchTerm),
        refreshTotalCount(activeBrandFilter, searchTerm),
        refreshDashboardStats(),
      ]);
    } catch (e) {
      console.error("Error deleting all products:", e);
      alert("Failed to delete all products.");
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[50vh]">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-medium">Loading Database...</p>
        </div>
      );
    }

    switch (currentView) {
      case AppView.UPLOAD:
        return <UploadView onExtractionComplete={handleExtractionComplete} />;
      case AppView.INVENTORY:
        return <InventoryView 
          products={products} 
          totalProducts={totalProducts}
          currentPage={currentPage}
          pageSize={PAGE_SIZE}
          hasNextPage={hasNextPage}
          isPageLoading={isPageLoading}
          activeBrandFilter={activeBrandFilter}
          searchInput={searchInput}
          activeSearchTerm={searchTerm}
          isSearching={isSearching}
          brandNotes={brandNotes}
          onNextPage={handleNextPage}
          onPreviousPage={handlePrevPage}
          onClearBrandFilter={handleClearBrandFilter}
          onSearchInputChange={handleSearchInputChange}
          onSearchSubmit={handleSearchSubmit}
          onUpdateProduct={handleUpdateProduct} 
          onDeleteProduct={handleDeleteProduct} 
          onDeleteAllProducts={handleDeleteAllProducts}
          onAddProduct={handleAddProduct}
        />;
      case AppView.DASHBOARD:
      default:
        return (
          <DashboardView
            totalProducts={dashboardTotalProducts}
            totalValue={dashboardTotalValue}
            brandCounts={dashboardBrandCounts}
            brandNotes={brandNotes}
            onBrandClick={handleBrandFromDashboard}
            onNavigateToUpload={() => setCurrentView(AppView.UPLOAD)}
            onAddBrandNote={handleAddBrandNote}
            onUpdateBrandNote={handleUpdateBrandNote}
            onDeleteBrandNote={handleDeleteBrandNote}
            onDeleteBrand={handleDeleteBrand}
            onAdjustBrandPrices={handleAdjustBrandPrices}
            deleteBrandProgress={deleteBrandProgress}
          />
        );
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-[13px] sm:text-base">
      <Navbar currentView={currentView} onChangeView={setCurrentView} />
      
      <main className="flex-1 mb-20 sm:mb-0">
        {renderContent()}
      </main>

      {showMappingModal && (
        <MappingModal 
          data={extractedData}
          onConfirm={handleMappingConfirm}
          onCancel={() => setShowMappingModal(false)}
        />
      )}
    </div>
  );
};

export default App;