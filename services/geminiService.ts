import { GoogleGenAI, Type } from "@google/genai";
import { RawExtractionItem } from "../types";

// We process images/pages one by one now to avoid token limits
const processImage = async (
  base64Data: string,
  mimeType: string = 'image/jpeg'
): Promise<RawExtractionItem[]> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Analyze this image of a price list page.
    Extract the product information into a JSON list.
    
    The output should be a strictly valid JSON array of objects.
    Each object represents a row in the table/list.
    
    IMPORTANT:
    1. Preserve keys exactly as they appear in headers. If headers are missing (e.g. cut off from previous page), infer keys like "Product Name", "Cost Price", "SRP Price", "Brand", "Code".
    2. If a row has multiple prices, capture BOTH: the lowest as "Cost Price" and the highest as "SRP Price".
    3. Prices (IDR/Rupiah): Convert "Rp 1.500.000" or "1.500.000" to integer 1500000. No dots, no commas, no symbols.
    4. Do not create nested objects. Flat structure only.
    5. If the page is empty or contains no product data, return an empty array [].
    
    Example output format:
    [
      { "Product Name": "Nikon D850", "Cost Price": 24000000, "SRP Price": 27000000, "Brand": "Nikon" },
      { "Product Name": "Canon R5", "Cost Price": 35000000, "SRP Price": 39999000, "Brand": "Canon" }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        // We use loose schema or just JSON mode to allow flexibility in column names between pages
        // but explicit enough to get array of objects
      },
    });

    const text = response.text;
    if (!text) return []; // Return empty if nothing generated
    
    try {
        const json = JSON.parse(text);
        if (Array.isArray(json)) return json as RawExtractionItem[];
        if (typeof json === 'object' && json !== null) {
            // Handle case where AI wraps it in { "products": [...] }
            const values = Object.values(json);
            const arrayVal = values.find(v => Array.isArray(v));
            if (arrayVal) return arrayVal as RawExtractionItem[];
        }
        return [];
    } catch (e) {
        console.warn("JSON parse failed, trying cleanup", e);
        // Basic cleanup for markdown code blocks if AI adds them despite MIME type
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '');
        return JSON.parse(cleanText) as RawExtractionItem[];
    }

  } catch (error) {
    console.error("Gemini API Error for page:", error);
    // If a single page fails, we might want to throw or return empty to continue others
    // For now, let's throw so the UI knows something went wrong
    throw error;
  }
};

const processText = async (textContent: string): Promise<RawExtractionItem[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Analyze the following extracted PDF text from a price list page.
    Extract product rows into a strictly valid JSON array of flat objects.

    Rules:
    1. Preserve original column/header names when present.
    2. If headers are missing, infer practical keys like "Product Name", "Price", "Brand", "Code".
    3. Convert Indonesian price formats such as "Rp 1.500.000" or "1.500.000" to integer 1500000.
    4. Ignore non-product rows (titles, page footers, metadata).
    5. Return [] if no product rows are detected.

    PDF text:
    ${textContent}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) return [];

    try {
      const json = JSON.parse(text);
      if (Array.isArray(json)) return json as RawExtractionItem[];
      if (typeof json === 'object' && json !== null) {
        const values = Object.values(json);
        const arrayVal = values.find(v => Array.isArray(v));
        if (arrayVal) return arrayVal as RawExtractionItem[];
      }
      return [];
    } catch {
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '');
      const parsed = JSON.parse(cleanText);
      return Array.isArray(parsed) ? (parsed as RawExtractionItem[]) : [];
    }
  } catch (error) {
    console.error("Gemini API Error for text page:", error);
    throw error;
  }
};

const similarityScore = (a: string, b: string): number => {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  if (aLower === bLower) return 1.0;

  // Check for key pattern matches
  const patterns = {
    name: /product|name|desc|item|title|artikel|produk/i,
    cost: /cost|dealer|net|wholesale|modal/i,
    srp: /srp|msrp|retail|list|suggested|base/i,
    price: /price|harga|nilai|rate/i,
    brand: /brand|merk|merek|supplier|vendor|pabrik/i,
    code: /code|sku|id|nomor|no|kode/i,
    qty: /qty|quantity|jumlah|stok|stock/i,
  };

  const aPatterns = Object.entries(patterns).filter(([_, pat]) => pat.test(a)).map(([k]) => k);
  const bPatterns = Object.entries(patterns).filter(([_, pat]) => pat.test(b)).map(([k]) => k);

  const aCost = patterns.cost.test(a);
  const bCost = patterns.cost.test(b);
  const aSrp = patterns.srp.test(a);
  const bSrp = patterns.srp.test(b);

  if ((aCost && bSrp) || (aSrp && bCost)) return 0.2;

  const overlap = aPatterns.filter((p) => bPatterns.includes(p)).length;
  if (overlap > 0) return 0.9;

  // Levenshtein-like distance for partial string similarity
  const minLen = Math.min(aLower.length, bLower.length);
  const maxLen = Math.max(aLower.length, bLower.length);
  let matches = 0;
  for (let i = 0; i < minLen; i++) {
    if (aLower[i] === bLower[i]) matches++;
  }
  return matches / maxLen;
};

const harmonizeColumnNames = (rows: RawExtractionItem[]): RawExtractionItem[] => {
  if (rows.length === 0) return rows;

  const allKeys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  if (allKeys.length === 0) return rows;

  const groups: Map<string, string[]> = new Map();
  const assigned = new Set<string>();

  for (const key of allKeys) {
    if (assigned.has(key)) continue;

    const group = [key];
    assigned.add(key);

    for (const otherKey of allKeys) {
      if (assigned.has(otherKey)) continue;
      const score = similarityScore(key, otherKey);
      if (score >= 0.75) {
        group.push(otherKey);
        assigned.add(otherKey);
      }
    }

    groups.set(key, group);
  }

  return rows.map((row) => {
    const normalized: RawExtractionItem = {};

    for (const [canonical, variants] of groups) {
      for (const variant of variants) {
        if (row.hasOwnProperty(variant)) {
          normalized[canonical] = row[variant];
          break;
        }
      }
    }

    return normalized;
  });
};

const processMessyTextList = async (rawText: string, brandHint?: string): Promise<RawExtractionItem[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
You are a price list parser and product name beautifier. Parse the following messy price list text and extract structured product data.

IMPORTANT RULES:
1. **Product Name Beautification**: Expand abbreviated product names to full, professional names
   - Example: "A7c 28-60" → "Sony Alpha A7C Kit FE 28-60mm f/4-5.6 OSS"
   - Example: "ILce 1m2 bo" → "Sony Alpha 1 Mark II Body Only"
   - Add proper capitalization, full lens names, body/kit specifications
   - "bo" or "body" = Body Only
   - Include lens specs when mentioned (focal length, aperture)

2. **Price Detection**: 
   - Lines typically contain: product name + multiple prices
   - The LOWEST price is usually the cost price (dealer/net price)
   - The HIGHEST price is usually SRP (suggested retail price)
   - Common formats: "rp 24.845" or "Rp 91.199" or "srp 99.999"
   - Convert to integer (remove dots/commas): 24845000, 91199000, etc.
   - Extract BOTH cost price (lowest) AND SRP price (highest)

3. **Brand Detection**:
   ${brandHint ? `- The brand is: ${brandHint}` : '- Detect brand from context or product names'}

4. **Output Format**: Return a JSON array with objects containing:
   {
     "Product Name": "Full beautified product name",
     "Cost Price": <integer cost price>,
     "SRP Price": <integer SRP/suggested retail price>,
     "Brand": "Brand name"
   }

5. **Ignore non-product lines**: Skip headers, dates, category titles, empty lines

Example Input:
"""
A7c 28-60 Rp 24.845 srp 27.999
ILce 1m2 bo rp 91.199 srp 99.999
"""

Example Output:
[
  {
    "Product Name": "Sony Alpha A7C Kit FE 28-60mm f/4-5.6 OSS",
    "Cost Price": 24845000,
    "SRP Price": 27999000,
    "Brand": "Sony"
  },
  {
    "Product Name": "Sony Alpha 1 Mark II Body Only",
    "Cost Price": 91199000,
    "SRP Price": 99999000,
    "Brand": "Sony"
  }
]

RAW TEXT TO PARSE:
${rawText}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) return [];

    try {
      const json = JSON.parse(text);
      if (Array.isArray(json)) return json as RawExtractionItem[];
      if (typeof json === 'object' && json !== null) {
        const values = Object.values(json);
        const arrayVal = values.find(v => Array.isArray(v));
        if (arrayVal) return arrayVal as RawExtractionItem[];
      }
      return [];
    } catch {
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '');
      const parsed = JSON.parse(cleanText);
      return Array.isArray(parsed) ? (parsed as RawExtractionItem[]) : [];
    }
  } catch (error) {
    console.error("Gemini API Error for messy text:", error);
    throw error;
  }
};

export const geminiService = {
  processImage,
  processText,
  harmonizeColumnNames,
  processMessyTextList,
};