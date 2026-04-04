import { GoogleGenAI } from '@google/genai';
import {
  getScholarshipsFromCSV,
  filterScholarships,
  Scholarship,
  ScholarshipFilters,
  UserProfile,
} from './scholarshipsData';

interface SearchFilters extends ScholarshipFilters {
  course: string;
  category: string;
  income: string;
  cgpa: string;
  type: 'All' | 'State' | 'Central' | 'Private';
  tags: string[];
}

interface AIScholarship {
  id: string;
  title: string;
  description: string;
  category: 'Government' | 'Corporate CSR' | 'Private' | 'International';
  reward: string;
  eligibility: string[];
  deadline: string;
  website: string;
  matchScore: number;
  source: 'csv_database' | 'web_retrieval' | 'State Government' | 'Central Government' | 'Private Trust';
  isFeatured?: boolean;
  aiInsight?: string;
  aiAugmented?: boolean;
  tags: string[];
  matchedBecause: string[];
}

interface RetrievedWebScholarship {
  title: string;
  description: string;
  reward?: string;
  deadline?: string;
  categoryRaw?: string;
  course?: string;
  state?: string;
  maxIncome?: number | null;
  minCgpa?: number | null;
  website: string;
  tags?: string[];
}

let aiBackoffUntil = 0;
let hasLoggedMissingApiKey = false;
let hasLoggedMissingRetrievalEndpoint = false;

function isDevRuntime(): boolean {
  const viteDev = Boolean((import.meta as any).env?.DEV);
  const nodeDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
  return viteDev || nodeDev;
}

function isAIInsightsEnabled(): boolean {
  const raw = (import.meta as any).env?.VITE_ENABLE_AI_INSIGHTS
    || (typeof process !== 'undefined' ? process.env?.VITE_ENABLE_AI_INSIGHTS : undefined);
  if (raw == null || raw === '') return true; // default ON (can be disabled explicitly)
  return String(raw).toLowerCase() === 'true';
}

function getRetrievalEndpoint(): string | undefined {
  return (
    (import.meta as any).env?.VITE_SCHOLARSHIP_RETRIEVAL_URL ||
    (typeof process !== 'undefined' ? process.env?.VITE_SCHOLARSHIP_RETRIEVAL_URL : undefined)
  );
}

function normalizeKey(title: string, website: string): string {
  return `${title.toLowerCase().trim()}|${website.toLowerCase().trim()}`;
}

function toAIScholarship(
  scholarship: Scholarship & { matchScore: number; matchedBecause: string[] },
  source: AIScholarship['source'],
): AIScholarship {
  return {
    id: scholarship.id,
    title: scholarship.title,
    description: scholarship.description,
    category: scholarship.category,
    reward: scholarship.reward,
    eligibility: scholarship.matchedBecause,
    deadline: scholarship.deadline,
    website: scholarship.link || 'https://scholarships.gov.in',
    matchScore: scholarship.matchScore,
    source,
    aiInsight: `Matched based on: ${scholarship.matchedBecause.join(', ')}.`,
    tags: scholarship.tags,
    matchedBecause: scholarship.matchedBecause,
  };
}

function toSafeProfile(profile: Partial<UserProfile>): Pick<UserProfile, 'course' | 'category' | 'income' | 'cgpa'> {
  return {
    course: profile.course || '',
    category: profile.category || '',
    income: profile.income || '',
    cgpa: profile.cgpa || '',
  };
}

function mapWebScholarshipsToNormalized(input: RetrievedWebScholarship[]): Scholarship[] {
  return input.map((item, index) => {
    const normalizedTitle = item.title.toLowerCase();
    const normalizedWebsite = item.website.toLowerCase();
    const isCentral =
      normalizedWebsite.includes('gov.in') ||
      normalizedWebsite.includes('nic.in') ||
      normalizedTitle.includes('national') ||
      normalizedTitle.includes('central');
    const scholarshipType = item.state && item.state !== 'All'
      ? 'State'
      : isCentral
        ? 'Central'
        : 'Private';
    return {
      id: `web_${index}_${Math.random().toString(36).slice(2, 8)}`,
      title: item.title,
      description: item.description,
      reward: item.reward || 'Varies',
      deadline: item.deadline || 'Ongoing',
      category: scholarshipType === 'Private' ? 'Private' : 'Government',
      tags: item.tags || [],
      state: item.state || 'All',
      link: item.website,
      maxIncome: item.maxIncome ?? null,
      minCgpa: item.minCgpa ?? null,
      course: item.course || 'Any',
      categoryRaw: item.categoryRaw || 'All',
      scholarshipType,
    };
  });
}

async function fetchWebScholarships(
  userProfile: Partial<UserProfile>,
  filters?: SearchFilters,
): Promise<RetrievedWebScholarship[]> {
  const endpoint = getRetrievalEndpoint();
  if (!endpoint) {
    if (!hasLoggedMissingRetrievalEndpoint && isDevRuntime()) {
      console.info('Web retrieval endpoint not configured; returning CSV-only results.');
      hasLoggedMissingRetrievalEndpoint = true;
    }
    return [];
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userProfile: toSafeProfile(userProfile), filters }),
    });

    if (!response.ok) {
      console.warn(`Web retrieval failed with status ${response.status}; returning CSV-only results.`);
      return [];
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) return [];
    return payload as RetrievedWebScholarship[];
  } catch (error) {
    console.warn('Web retrieval request failed; returning CSV-only results.', error);
    return [];
  }
}

async function generateAIInsights(
  results: AIScholarship[],
  userProfile: Partial<UserProfile>,
): Promise<AIScholarship[]> {
  if (!isAIInsightsEnabled()) {
    return results;
  }

  const safeNodeApiKey = typeof process !== 'undefined' ? process.env?.VITE_GEMINI_API_KEY : undefined;
  const apiKey = safeNodeApiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    if (!hasLoggedMissingApiKey) {
      console.info('Gemini API key not configured; returning deterministic CSV/web results without AI insights.');
      hasLoggedMissingApiKey = true;
    }
    return results;
  }

  if (Date.now() < aiBackoffUntil) {
    return results;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const safeProfile = toSafeProfile(userProfile);

    const top = results.slice(0, 5);
    const prompt = `Generate a one-line recommendation reason per scholarship for this user profile.
User profile: ${JSON.stringify(safeProfile)}
Scholarships: ${JSON.stringify(top.map(s => ({ title: s.title, matchedBecause: s.matchedBecause })))}
Return JSON array with: [{"title":"...","aiInsight":"..."}]`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const insights = JSON.parse(response.text) as Array<{ title: string; aiInsight: string }>;
    const map = new Map(insights.map(item => [item.title.trim().toLowerCase(), item.aiInsight]));

    return results.map((result) => {
      const aiInsight = map.get(result.title.trim().toLowerCase());
      return {
        ...result,
        aiInsight:
          aiInsight ||
          `Matched for your ${userProfile.course || 'academic'} profile (${result.matchedBecause.join(', ')}).`,
        aiAugmented: Boolean(aiInsight),
      };
    });
  } catch (error) {
    const errorText = String((error as any)?.message || error || '');
    const isQuotaError =
      errorText.includes('429') ||
      errorText.toLowerCase().includes('quota exceeded') ||
      errorText.toLowerCase().includes('resource_exhausted');

    if (isQuotaError) {
      const retrySeconds = Number((errorText.match(/retry in\\s+(\\d+(?:\\.\\d+)?)s/i)?.[1] ?? '60'));
      aiBackoffUntil = Date.now() + Math.max(30, retrySeconds) * 1000;
      console.warn(`AI quota exceeded. Falling back to deterministic results until ${new Date(aiBackoffUntil).toISOString()}.`);
      return results;
    }

    console.warn('AI insight generation failed; using deterministic output.');
    return results;
  }
}


const DYNAMIC_SCHOLARSHIP_FETCH_DELAY_MS = (() => {
  const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const isBrowser = typeof window !== 'undefined';
  if (isTestEnv || !isBrowser) {
    return 0;
  }
  return 800;
})();

export async function fetchDynamicScholarships(): Promise<Scholarship[]> {
  if (DYNAMIC_SCHOLARSHIP_FETCH_DELAY_MS > 0) {
    await new Promise(resolve => setTimeout(resolve, DYNAMIC_SCHOLARSHIP_FETCH_DELAY_MS));
  }

  // Simulated structured data representing fetches from:
  // Karnataka State Government (https://ssp.karnataka.gov.in)
  // Central Government (https://scholarships.gov.in)
  // Private Trust / NGO (https://buddy4study.com)

  const rawData: Scholarship[] = [
    // --- State Government (Karnataka) ---
    {
      id: 'state_1',
      title: 'Post Matric Scholarship for SC/ST Students',
      description: 'Karnataka State Government scheme for SC/ST students pursuing post-matriculation courses.',
      reward: 'Tuition fee waiver & maintenance allowance',
      deadline: '2026-10-31',
      category: 'Government',
      tags: ['SC/ST', 'UG', 'PG', 'Karnataka'],
      state: 'Karnataka',
      link: 'https://ssp.karnataka.gov.in',
      maxIncome: 250000,
      minCgpa: null,
      course: 'Any',
      categoryRaw: 'SC/ST',
      scholarshipType: 'State',
      source: 'State Government', // This satisfies the user requested source format
    },
    {
      id: 'state_2',
      title: 'Vidyasiri Scholarship (OBC)',
      description: 'Fee concession scheme and food/accommodation assistance for OBC students in Karnataka.',
      reward: '₹15,000 per annum',
      deadline: '2026-11-15',
      category: 'Government',
      tags: ['OBC', 'Karnataka', 'UG', 'PG'],
      state: 'Karnataka',
      link: 'https://ssp.karnataka.gov.in',
      maxIncome: 100000,
      minCgpa: 60,
      course: 'Any',
      categoryRaw: 'OBC',
      scholarshipType: 'State',
      source: 'State Government',
    },

    // --- Central Government ---
    {
      id: 'central_1',
      title: 'National Means Cum Merit Scholarship',
      description: 'Central Government scheme providing financial assistance to meritorious students from economically weaker sections.',
      reward: '₹12,000 per annum',
      deadline: '2026-11-30',
      category: 'Government',
      tags: ['Merit', 'EWS', 'School'],
      state: 'All',
      link: 'https://scholarships.gov.in',
      maxIncome: 350000,
      minCgpa: 55,
      course: 'School',
      categoryRaw: 'EWS',
      scholarshipType: 'Central',
      source: 'Central Government',
    },
    {
      id: 'central_2',
      title: 'Central Sector Scheme of Scholarships for College and University Students',
      description: 'Provides financial assistance to meritorious students from low income families to meet day-to-day expenses.',
      reward: '₹10,000 to ₹20,000 per annum',
      deadline: '2026-12-31',
      category: 'Government',
      tags: ['Merit', 'UG', 'PG', 'All'],
      state: 'All',
      link: 'https://scholarships.gov.in',
      maxIncome: 450000,
      minCgpa: 80,
      course: 'UG',
      categoryRaw: 'All',
      scholarshipType: 'Central',
      source: 'Central Government',
    },

    // --- Private Trust / NGO ---
    {
      id: 'private_1',
      title: 'HDFC Bank Parivartan Scholarship',
      description: 'Merit-cum-means scholarship for school and college students aiming to prevent dropouts due to financial crises.',
      reward: 'Up to ₹75,000',
      deadline: '2026-09-30',
      category: 'Private',
      tags: ['Merit', 'Needs-based', 'UG', 'PG', 'School'],
      state: 'All',
      link: 'https://buddy4study.com/scholarship/hdfc-bank-parivartan',
      maxIncome: 250000,
      minCgpa: 55,
      course: 'Any',
      categoryRaw: 'All',
      scholarshipType: 'Private',
      source: 'Private Trust',
    },
    {
      id: 'private_2',
      title: 'Reliance Foundation Undergraduate Scholarships',
      description: 'Private Trust scholarship to support meritorious students from across India for their undergraduate education.',
      reward: 'Up to ₹2,00,000 over the degree duration',
      deadline: '2026-10-15',
      category: 'Private',
      tags: ['Merit', 'UG'],
      state: 'All',
      link: 'https://buddy4study.com/scholarship/reliance-foundation',
      maxIncome: 1500000,
      minCgpa: 75,
      course: 'UG',
      categoryRaw: 'All',
      scholarshipType: 'Private',
      source: 'Private Trust',
    }
  ];

  return rawData;
}

export async function getHybridScholarships(
  userProfile: Partial<UserProfile>,
  filters?: SearchFilters,
): Promise<AIScholarship[]> {
  let dynamicScholarships: Scholarship[] = [];
  try {
    dynamicScholarships = await fetchDynamicScholarships();
  } catch (err) {
    console.error("Failed to fetch dynamic scholarships", err);
  }

  let dynamicEligible = filterScholarships(dynamicScholarships, userProfile, filters, 'strict').map((item) =>
    toAIScholarship(item, (item as any).source || 'web_retrieval')
  );

  let webEligible: AIScholarship[] = [];
  let webRetrieved: any[] = [];
  try {
    webRetrieved = await fetchWebScholarships(userProfile, filters);
    const webNormalized = mapWebScholarshipsToNormalized(webRetrieved);
    webEligible = filterScholarships(webNormalized, userProfile, filters, 'strict').map((item) =>
      toAIScholarship(item, 'web_retrieval'),
    );
  } catch (error) {
    console.error('Hybrid search failed; web retrieval error.', error);
  }

  let merged: AIScholarship[] = [];
  let seen = new Set<string>();

  for (const item of [...dynamicEligible, ...webEligible]) {
    const key = normalizeKey(item.title, item.website);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  let tagFiltered = merged.filter((item) => {
    if (!filters?.tags?.length) return true;
    return filters.tags.some(tag => item.tags.includes(tag));
  });

  // FALLBACK LOGIC
  if (tagFiltered.length === 0 && dynamicScholarships.length > 0) {
    console.info('No strict matches found. Falling back to relaxed dynamic results.');
    const relaxedDynamicEligible = filterScholarships(dynamicScholarships, userProfile, filters, 'relaxed').map((item) =>
      toAIScholarship(item, (item as any).source || 'web_retrieval'),
    );

    seen.clear();
    merged = [];
    for (const item of relaxedDynamicEligible) {
      const key = normalizeKey(item.title, item.website);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }

    tagFiltered = merged.filter((item) => {
      if (!filters?.tags?.length) return true;
      return filters.tags.some(tag => item.tags.includes(tag));
    });
  }

  const ranked = tagFiltered.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return a.title.localeCompare(b.title);
  });

  let finalized: AIScholarship[] = [];
  try {
    const withInsights = await generateAIInsights(ranked, userProfile);
    finalized = withInsights.map((item, idx) => ({
      ...item,
      isFeatured: idx < 3,
      aiInsight: item.aiInsight || `Matched based on: ${item.matchedBecause.join(', ')}.`,
    }));
  } catch (error) {
    console.error('AI Insights generation failed.', error);
    finalized = ranked.map((item, idx) => ({
      ...item,
      isFeatured: idx < 3,
      aiInsight: item.aiInsight || `Matched based on: ${item.matchedBecause.join(', ')}.`,
    }));
  }

  if (isDevRuntime()) {
    console.info('Scholarship search source counts', {
      dynamicMatched: dynamicEligible.length,
      webFound: webRetrieved.length,
      webEligible: webEligible.length,
      finalReturned: finalized.length,
    });
  }

  return finalized;
}
