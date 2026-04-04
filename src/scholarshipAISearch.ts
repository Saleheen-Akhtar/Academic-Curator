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
  source: 'csv_database' | 'web_retrieval';
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

export async function getHybridScholarships(
  userProfile: Partial<UserProfile>,
  filters?: SearchFilters,
): Promise<AIScholarship[]> {
  const csvScholarships = getScholarshipsFromCSV();
  const csvEligible = filterScholarships(csvScholarships, userProfile, filters).map((item) =>
    toAIScholarship(item, 'csv_database'),
  );

  try {
    const webRetrieved = await fetchWebScholarships(userProfile, filters);
    const webNormalized = mapWebScholarshipsToNormalized(webRetrieved);
    const webEligible = filterScholarships(webNormalized, userProfile, filters).map((item) =>
      toAIScholarship(item, 'web_retrieval'),
    );

    const merged: AIScholarship[] = [];
    const seen = new Set<string>();

    for (const item of [...csvEligible, ...webEligible]) {
      const key = normalizeKey(item.title, item.website);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }

    const tagFiltered = merged.filter((item) => {
      if (!filters?.tags?.length) return true;
      return filters.tags.some(tag => item.tags.includes(tag));
    });

    const ranked = tagFiltered.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return a.title.localeCompare(b.title);
    });

    const withInsights = await generateAIInsights(ranked, userProfile);
    const finalized = withInsights.map((item, idx) => ({
      ...item,
      isFeatured: idx < 3,
      aiInsight: item.aiInsight || `Matched based on: ${item.matchedBecause.join(', ')}.`,
    }));

    if (isDevRuntime()) {
      console.info('Scholarship search source counts', {
        csvMatched: csvEligible.length,
        webFound: webRetrieved.length,
        webEligible: webEligible.length,
        finalReturned: finalized.length,
      });
    }

    return finalized;
  } catch (error) {
    console.error('Hybrid search failed; returning CSV eligibility results only.', error);
    if (isDevRuntime()) {
      console.info('Scholarship search source counts', {
        csvMatched: csvEligible.length,
        webFound: 0,
        finalReturned: csvEligible.length,
      });
    }
    return csvEligible.map((item, idx) => ({
      ...item,
      isFeatured: idx < 3,
      aiInsight: item.aiInsight || `Matched based on: ${item.matchedBecause.join(', ')}.`,
    }));
  }
}
