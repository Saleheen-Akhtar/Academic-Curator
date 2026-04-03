export type ScholarshipType = 'State' | 'Central' | 'Private';

// Scholarship interface (matches definition in App.tsx and adds normalized CSV metadata)
export interface Scholarship {
  id: string;
  title: string;
  description: string;
  reward: string;
  deadline: string;
  category: 'Government' | 'Corporate CSR' | 'Private' | 'International';
  matchScore?: number;
  aiInsight?: string;
  isFeatured?: boolean;
  tags: string[];
  // Normalized metadata for deterministic filtering/classification
  state?: string;
  link?: string;
  maxIncome?: number | null;
  minCgpa?: number | null;
  course?: string;
  categoryRaw?: string;
  scholarshipType?: ScholarshipType;
}

interface RawScholarship {
  Name: string;
  'Scholarship Name'?: string;
  Category: string;
  Income: string;
  'Annual Income'?: string;
  CGPA: string;
  'Current CGPA / %'?: string;
  Course: string;
  'Scholarship Type'?: string;
  Level: string;
  State: string;
  Deadline: string;
  Link: string;
}

function loadCsvSource(): string {
  const injectedCsv = (globalThis as any).__SCHOLARSHIPS_CSV__;
  if (typeof injectedCsv === 'string' && injectedCsv.length > 0) {
    return injectedCsv;
  }

  if (typeof window === 'undefined') {
    try {
      const req = Function('try { return require; } catch { return null; }')() as
        | ((id: string) => any)
        | null;
      if (req) {
        const fs = req('node:fs');
        const path = req('node:path');
        const csvCandidates = [
          path.join(process.cwd(), 'scholarships.csv'),
          path.join(process.cwd(), 'public', 'scholarships.csv'),
        ];
        for (const candidate of csvCandidates) {
          if (fs.existsSync(candidate)) {
            return fs.readFileSync(candidate, 'utf8');
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load scholarships.csv in Node runtime.', error);
    }
    return '';
  }

  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/scholarships.csv', false);
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300) {
      return xhr.responseText;
    }
  } catch (error) {
    console.warn('Failed to load scholarships.csv in browser runtime.', error);
  }

  return '';
}

const scholarshipsCsvRaw = loadCsvSource();

export interface UserProfile {
  course: string;
  category: string;
  income: string;
  cgpa: string;
}

export interface ScholarshipFilters {
  course?: string;
  category?: string;
  income?: string;
  cgpa?: string;
  type?: 'All' | ScholarshipType;
}

function parseDate(dateStr: string): string {
  if (!dateStr) return 'Rolling';
  const compact = dateStr.trim();
  const monthFirst = compact.match(/^([A-Za-z]{3})-(\d{1,2})$/);
  if (monthFirst) return `${monthFirst[2]} ${monthFirst[1]}`;
  const [day, month] = compact.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[Math.max(0, (parseInt(month, 10) || 1) - 1)] ?? 'Jan';
  return `${day} ${monthName}`;
}

function parseCSV(csv: string): RawScholarship[] {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const data: RawScholarship[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      obj[header] = values[idx] ?? '';
    });
    const row = obj as unknown as RawScholarship;
    if (!(row.Name || row['Scholarship Name'] || '').trim()) continue;
    data.push(row);
  }

  return data;
}

function normalizeIncome(value: string): number | null {
  if (!value || value.toLowerCase() === 'no limit') return null;
  const normalized = value.toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ').trim();
  const lakhMatch = normalized.match(/(\d+(?:\.\d+)?)\s*lakh/);
  if (lakhMatch) return Math.round(parseFloat(lakhMatch[1]) * 100000);
  const digits = normalized.match(/\d+/g);
  if (!digits?.length) return null;
  const parsed = parseInt(digits[digits.length - 1], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeCgpa(value: string): number | null {
  if (!value) return null;
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed)) return null;
  if (value.includes('%')) return parsed / 10;
  return parsed;
}

function userIncomeToAmount(userIncome: string): number {
  const incomeMap: Record<string, number> = {
    '< 1L': 100000,
    '1 - 2.5L': 250000,
    '2.5 - 5L': 500000,
  };
  return incomeMap[userIncome] ?? Number.MAX_SAFE_INTEGER;
}

function userCgpaToAmount(userCgpa: string): number {
  const cgpaMap: Record<string, number> = {
    '9+': 9,
    '8+': 8,
    '7+': 7,
    '6+': 6,
  };
  return cgpaMap[userCgpa] ?? 0;
}

function deriveScholarshipType(raw: RawScholarship): ScholarshipType {
  if (raw.State && raw.State !== 'All') return 'State';

  const lowerName = (raw.Name || raw['Scholarship Name'] || '').toLowerCase();
  const lowerLink = (raw.Link || '').toLowerCase();
  const centralIndicators = ['gov.in', 'nic.in', 'scholarships.gov.in', 'aicte', 'nsp', 'national', 'central'];
  const isCentral = centralIndicators.some(indicator => lowerName.includes(indicator) || lowerLink.includes(indicator));

  return isCentral ? 'Central' : 'Private';
}

function toDisplayCategory(type: ScholarshipType): Scholarship['category'] {
  if (type === 'Private') return 'Private';
  return 'Government';
}

function splitTokens(raw: string): string[] {
  return raw.split(/[\/,]/).map(item => item.trim()).filter(Boolean);
}

function generateTags(raw: RawScholarship): string[] {
  const tags: string[] = [];

  const courseTokens = splitTokens(raw.Course);
  if (courseTokens.length > 0 && raw.Course !== 'Any') {
    tags.push(...courseTokens);
  }

  const categoryTokens = splitTokens(raw.Category);
  const rawCategory = raw.Category.trim();

  if (rawCategory === 'All') {
    tags.push('General', 'SC', 'ST', 'OBC', 'EWS', 'PWD', 'Girls', 'Minority');
  } else {
    tags.push(...categoryTokens);
    if (rawCategory === 'Disabled') tags.push('PWD');
  }

  if (raw.State === 'All') {
    tags.push('Central', 'National');
  } else {
    tags.push('State', raw.State);
  }

  return [...new Set(tags)];
}

function categoryMatches(userCategory: string, scholarshipCategoryRaw: string): boolean {
  if (!userCategory) return true;

  const normalized = scholarshipCategoryRaw.toLowerCase();
  const categoryMap: Record<string, string[]> = {
    'General': ['all', 'general', 'girls', 'minority'],
    'SC': ['all', 'sc', 'sc/st', 'sc/st/obc', 'minority'],
    'ST': ['all', 'st', 'sc/st', 'sc/st/obc', 'minority'],
    'OBC': ['all', 'obc', 'sc/st/obc', 'minority'],
    'EWS': ['all', 'ews'],
    'PWD': ['all', 'disabled', 'pwd'],
    'Girls': ['all', 'girls'],
    'Minority': ['all', 'minority'],
    '2A': ['all', 'general'],
    '3A': ['all', 'general'],
    '3B': ['all', 'general'],
  };

  const allowed = categoryMap[userCategory] ?? ['all'];
  return allowed.some(item => normalized.includes(item));
}

function incomeEligible(userIncome: string, scholarshipMaxIncome: number | null | undefined): boolean {
  if (!userIncome || scholarshipMaxIncome == null) return true;
  return userIncomeToAmount(userIncome) <= scholarshipMaxIncome;
}

function cgpaEligible(userCGPA: string, scholarshipMinCGPA: number | null | undefined): boolean {
  if (!userCGPA || scholarshipMinCGPA == null) return true;
  return userCgpaToAmount(userCGPA) >= scholarshipMinCGPA;
}

function courseRelevant(userCourse: string, scholarshipCourse: string | undefined): boolean {
  if (!userCourse || !scholarshipCourse || scholarshipCourse === 'Any') return true;
  const normalizedUserCourse = userCourse.toLowerCase();
  return splitTokens(scholarshipCourse)
    .map(token => token.toLowerCase())
    .some(token => normalizedUserCourse.includes(token) || token.includes(normalizedUserCourse));
}

function computeMatchScore(params: {
  categoryOk: boolean;
  incomeOk: boolean;
  cgpaOk: boolean;
  courseOk: boolean;
}): number {
  let score = 0;
  if (params.categoryOk) score += 30;
  if (params.incomeOk) score += 25;
  if (params.cgpaOk) score += 25;
  if (params.courseOk) score += 20;
  return score;
}

function createMatchedBecause(params: {
  categoryOk: boolean;
  incomeOk: boolean;
  cgpaOk: boolean;
  courseOk: boolean;
}): string[] {
  const reasons: string[] = [];
  if (params.categoryOk) reasons.push('Category eligible');
  if (params.incomeOk) reasons.push('Income eligible');
  if (params.cgpaOk) reasons.push('Merit/CGPA eligible');
  if (params.courseOk) reasons.push('Course relevant');
  return reasons;
}

function hasUserInput(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function getScholarshipsFromCSV(): Scholarship[] {
  const rawData = parseCSV(scholarshipsCsvRaw);

  return rawData.map((raw, index) => {
    const title = raw.Name || raw['Scholarship Name'] || '';
    const incomeRaw = raw.Income || raw['Annual Income'] || '';
    const cgpaRaw = raw.CGPA || raw['Current CGPA / %'] || '';
    const maxIncome = normalizeIncome(incomeRaw);
    const minCgpa = normalizeCgpa(cgpaRaw);
    const scholarshipType = deriveScholarshipType(raw);

    return {
      id: (index + 1).toString(),
      title,
      description: `${raw.Course} scholarship for ${raw.Category !== 'All' ? raw.Category : 'all categories'}. Maximum family income: ${maxIncome == null ? 'No limit' : `₹${maxIncome.toLocaleString('en-IN')}`}. Minimum CGPA required: ${cgpaRaw || 'Not specified'}.`,
      reward: `Varies${maxIncome == null ? '' : ` (Max Income: ₹${(maxIncome / 100000).toFixed(1)}L)`}`,
      deadline: parseDate(raw.Deadline),
      category: toDisplayCategory(scholarshipType),
      tags: generateTags(raw),
      state: raw.State,
      link: raw.Link,
      maxIncome,
      minCgpa,
      course: raw.Course,
      categoryRaw: raw.Category,
      scholarshipType,
      matchScore: undefined,
    };
  });
}

export const SCHOLARSHIPS_FROM_CSV = getScholarshipsFromCSV();

export function filterScholarships(
  scholarships: Scholarship[],
  userProfile: Partial<UserProfile>,
  filters?: ScholarshipFilters
): Array<Scholarship & { matchScore: number; matchedBecause: string[] }> {
  const profile = {
    course: filters?.course || userProfile.course || '',
    category: filters?.category || userProfile.category || '',
    income: filters?.income || userProfile.income || '',
    cgpa: filters?.cgpa || userProfile.cgpa || '',
  };

  const eligible = scholarships
    .map((scholarship) => {
      const categorySpecified = hasUserInput(profile.category);
      const incomeSpecified = hasUserInput(profile.income);
      const cgpaSpecified = hasUserInput(profile.cgpa);
      const courseSpecified = hasUserInput(profile.course);

      const categoryOk = categoryMatches(profile.category, scholarship.categoryRaw ?? 'All');
      const incomeOk = incomeEligible(profile.income, scholarship.maxIncome);
      const cgpaOk = cgpaEligible(profile.cgpa, scholarship.minCgpa);
      const courseOk = courseRelevant(profile.course, scholarship.course);

      const failedHardEligibility =
        (categorySpecified && !categoryOk) ||
        (incomeSpecified && !incomeOk) ||
        (cgpaSpecified && !cgpaOk) ||
        (courseSpecified && !courseOk);

      const isEligible = !failedHardEligibility;
      if (!isEligible) return null;

      const matchScore = computeMatchScore({
        categoryOk: categorySpecified ? categoryOk : false,
        incomeOk: incomeSpecified ? incomeOk : false,
        cgpaOk: cgpaSpecified ? cgpaOk : false,
        courseOk: courseSpecified ? courseOk : false,
      });

      const matchedBecause = createMatchedBecause({
        categoryOk: categorySpecified ? categoryOk : false,
        incomeOk: incomeSpecified ? incomeOk : false,
        cgpaOk: cgpaSpecified ? cgpaOk : false,
        courseOk: courseSpecified ? courseOk : false,
      });

      return {
        ...scholarship,
        matchScore,
        matchedBecause: matchedBecause.length > 0 ? matchedBecause : ['General eligibility match'],
      };
    })
    .filter((item): item is Scholarship & { matchScore: number; matchedBecause: string[] } => item !== null);

  const typeFiltered = eligible.filter((scholarship) => {
    if (!filters?.type || filters.type === 'All') return true;
    return scholarship.scholarshipType === filters.type;
  });

  return typeFiltered.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return a.title.localeCompare(b.title);
  });
}
