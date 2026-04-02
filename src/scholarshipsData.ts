// Scholarship interface (matches definition in App.tsx)
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
}

// Parse CSV data and convert to Scholarship format
const RAW_SCHOLARSHIPS = `Name,Category,Income,CGPA,Course,Level,State,Deadline,Link
NSP Scholarship,All,250000,6,Any,All Levels,All,30-09-2026,https://scholarships.gov.in
Post Matric Scholarship,SC/ST,250000,5,PUC/Degree,Post-Matric,All,15-10-2026,https://scholarships.gov.in
Pre Matric Scholarship,SC/ST,250000,5,School,10th,All,15-10-2026,https://scholarships.gov.in
Merit Cum Means Scholarship,Minority,250000,6,Professional,Engineering/Medical,All,31-10-2026,https://scholarships.gov.in
Central Sector Scheme,All,800000,8,PUC/Degree,PUC,All,15-09-2026,https://scholarships.gov.in
INSPIRE Scholarship,All,500000,8.5,Science,PUC/Science,All,31-10-2026,https://online-inspire.gov.in
AICTE Pragati Scholarship,Girls,800000,6,Engineering,Engineering,All,30-11-2026,https://www.aicte-india.org
AICTE Saksham Scholarship,Disabled,800000,5,Engineering,Engineering,All,30-11-2026,https://www.aicte-india.org
Karnataka SSP Scholarship,SC/ST/OBC,200000,5,Any,All Levels,Karnataka,20-09-2026,https://ssp.postmatric.karnataka.gov.in
Vidyasiri Scholarship,SC/ST/OBC,200000,5,Degree,PUC/Degree,Karnataka,10-10-2026,https://ssp.karnataka.gov.in
Epass Karnataka,SC/ST,200000,5,Any,All Levels,Karnataka,15-10-2026,https://karepass.cgg.gov.in
National Means Cum Merit Scholarship,All,150000,5.5,School,10th,All,31-10-2026,https://scholarships.gov.in
PM Scholarship Scheme,All,600000,6,Professional,Engineering/Medical,All,31-10-2026,https://ksb.gov.in
LIC Golden Jubilee Scholarship,All,200000,6,Any,PUC/Degree,All,31-10-2026,https://licindia.in
HDFC Educational Crisis Scholarship,All,250000,5.5,Any,All Levels,All,31-12-2026,https://www.hdfcbank.com
Tata Scholarship,All,500000,6.5,Any,All Levels,All,30-11-2026,https://www.tatatrusts.org
Aditya Birla Scholarship,All,600000,7.5,Professional,Engineering,All,15-11-2026,https://www.birla.com
Sitaram Jindal Scholarship,All,400000,6.5,Any,All Levels,All,30-09-2026,https://www.jsindaltrust.org
ONGC Scholarship,All,450000,6,Engineering,Engineering,All,31-10-2026,https://ongcindia.com
Foundation for Excellence,All,300000,7,Engineering,Engineering,All,15-10-2026,https://ffe.org
Google Generation Scholarship,Girls,No Limit,7,CS/IT,Engineering,All,30-11-2026,https://buildyourfuture.withgoogle.com
Adobe Women in Tech Scholarship,Girls,No Limit,7,CS/IT,Engineering,All,15-11-2026,https://www.adobe.com
Flipkart Foundation Scholarship,All,500000,6,Any,PUC/Degree,All,30-10-2026,https://www.flipkartfoundation.org
Reliance Foundation Scholarship,All,600000,6.5,Any,PUC/Degree,All,30-11-2026,https://www.reliancefoundation.org
IOCL Scholarship,All,400000,6,Engineering,Engineering,All,31-10-2026,https://iocl.com
UP Scholarship,All,200000,5,Any,All Levels,Uttar Pradesh,20-10-2026,https://scholarship.up.gov.in
West Bengal Swami Vivekananda Scholarship,All,250000,6,Any,PUC/Degree,West Bengal,15-11-2026,https://wbmdfc.org
Maharashtra Scholarship,All,300000,5.5,Any,PUC/Degree,Maharashtra,20-10-2026,https://mahadbtmahait.gov.in
Telangana Epass,SC/ST/OBC,200000,5,Any,All Levels,Telangana,15-10-2026,https://telanganaepass.cgg.gov.in
Delhi Scholarship Scheme,All,300000,6,Any,All Levels,Delhi,31-10-2026,https://edudel.nic.in
Kerala Scholarship,All,300000,5.5,Any,All Levels,Kerala,20-10-2026,https://dcescholarship.kerala.gov.in
Punjab Scholarship,All,250000,5,Any,All Levels,Punjab,15-10-2026,https://punjabscholarships.gov.in`;

interface RawScholarship {
  Name: string;
  Category: string;
  Income: string;
  CGPA: string;
  Course: string;
  Level: string;
  State: string;
  Deadline: string;
  Link: string;
}

function parseDate(dateStr: string): string {
  // Convert DD-MM-YYYY to "DD Mon" format
  const [day, month, year] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[parseInt(month) - 1]}`;
}

function parseCSV(csv: string): RawScholarship[] {
  const lines = csv.split('\n');
  const headers = lines[0].split(',');
  const data: RawScholarship[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].split(',');
    const obj: any = {};
    headers.forEach((header, idx) => {
      obj[header] = values[idx]?.trim();
    });
    data.push(obj);
  }

  return data;
}

function determineScholarshipCategory(name: string, state: string): 'Government' | 'Corporate CSR' | 'Private' | 'International' {
  const govKeywords = ['govt', 'government', 'ministry', 'national', 'state', 'central sector', 'nsp', 'ssp', 'epass'];
  const isGovernment = govKeywords.some(kw => name.toLowerCase().includes(kw));
  
  if (isGovernment) return 'Government';
  if (state === 'All' || state === 'international') return 'Corporate CSR';
  return 'Private';
}

function generateTags(raw: RawScholarship): string[] {
  const tags: string[] = [];

  // Add course tags
  if (raw.Course !== 'Any') {
    const courses = raw.Course.split('/').map((c: string) => c.trim());
    tags.push(...courses);
  }

  // Add category tags - IMPORTANT: ensure all scholarships have category tags
  const rawCategory = raw.Category.trim();
  
  if (rawCategory === 'All') {
    // "All" category scholarships are available to everyone
    tags.push('General', '2A', '3A', '3B', 'SC', 'ST', 'OBC', 'PWD');
  } else if (rawCategory.includes('SC') || rawCategory.includes('ST') || rawCategory.includes('OBC')) {
    // Handle SC/ST/OBC combinations
    if (rawCategory.includes('SC')) tags.push('SC');
    if (rawCategory.includes('ST')) tags.push('ST');
    if (rawCategory.includes('OBC')) tags.push('OBC');
  } else if (rawCategory === 'Minority') {
    tags.push('SC', 'ST', 'OBC', 'General'); // Minority includes these groups
  } else if (rawCategory === 'Girls') {
    tags.push('General', '2A', '3A', '3B', 'SC', 'ST', 'OBC'); // Girls scholarships for all categories
  } else if (rawCategory === 'Disabled') {
    tags.push('PWD', 'General', '2A', '3A', '3B', 'SC', 'ST', 'OBC');
  }

  // Add income level tags
  const income = parseInt(raw.Income);
  if (income <= 150000) tags.push('< 1L');
  else if (income <= 250000) tags.push('1 - 2.5L');
  else if (income <= 500000) tags.push('2.5 - 5L');

  // Add scholarship type
  if (raw.State === 'All') {
    tags.push('Central', 'National');
  } else {
    tags.push('State', raw.State);
  }

  // Add level
  if (raw.Level.includes('Engineering')) tags.push('Engineering');
  if (raw.Level.includes('Medical')) tags.push('Medical');
  if (raw.Level.includes('Science')) tags.push('Science');

  return [...new Set(tags)]; // Remove duplicates
}

export function getScholarshipsFromCSV(): Scholarship[] {
  const rawData = parseCSV(RAW_SCHOLARSHIPS);

  return rawData.map((raw, index) => {
    const tags = generateTags(raw);
    
    return {
      id: (index + 1).toString(),
      title: raw.Name,
      description: `${raw.Course} scholarship for ${raw.Category !== 'All' ? raw.Category : 'all categories'}. Maximum family income: ₹${parseInt(raw.Income).toLocaleString('en-IN')}. Minimum CGPA required: ${raw.CGPA}.`,
      reward: `Varies (Max Income: ₹${(parseInt(raw.Income) / 100000).toFixed(1)}L)`,
      deadline: parseDate(raw.Deadline),
      category: determineScholarshipCategory(raw.Name, raw.State),
      tags,
      matchScore: undefined,
    } as Scholarship;
  });
}

export const SCHOLARSHIPS_FROM_CSV = getScholarshipsFromCSV();

// Helper to check if user category matches scholarship category
function categoryMatches(userCategory: string, scholarshipCategory: string): boolean {
  // Map user categories to CSV categories
  const categoryMap: { [key: string]: string[] } = {
    '2A': ['All', 'General'],
    '3A': ['All', 'General'],
    '3B': ['All', 'General'],
    'SC': ['All', 'SC', 'SC/ST', 'SC/ST/OBC'],
    'ST': ['All', 'ST', 'SC/ST', 'SC/ST/OBC'],
    'OBC': ['All', 'OBC', 'SC/ST/OBC'],
    'PWD': ['All', 'Disabled'],
  };

  const validCategories = categoryMap[userCategory] || ['All'];
  return validCategories.some(cat => scholarshipCategory.includes(cat));
}

// Helper to check income eligibility
function incomeEligible(userIncome: string, scholarshipMaxIncome: number): boolean {
  const incomeMap: { [key: string]: number } = {
    '< 1L': 100000,
    '1 - 2.5L': 250000,
    '2.5 - 5L': 500000,
  };

  const userIncomeAmount = incomeMap[userIncome] || 500000;
  return userIncomeAmount <= scholarshipMaxIncome;
}

// Helper to check CGPA eligibility
function cgpaEligible(userCGPA: string, scholarshipCGPA: number): boolean {
  const cgpaMap: { [key: string]: number } = {
    '9+': 9.0,
    '8+': 8.0,
    '7+': 7.0,
    '6+': 6.0,
  };

  const userCGPAAmount = cgpaMap[userCGPA] || 6.0;
  return userCGPAAmount >= scholarshipCGPA;
}

interface UserProfile {
  course: string;
  category: string;
  income: string;
  cgpa: string;
}

// Filter scholarships based on user profile and search filters
export function filterScholarships(
  scholarships: Scholarship[],
  userProfile: Partial<UserProfile>,
  filters?: {
    course?: string;
    category?: string;
    income?: string;
    cgpa?: string;
  }
): Array<Scholarship & { matchScore: number }> {
  return scholarships
    .map(scholarship => {
      let matchScore = 0;

      // Category matching (30 points)
      if (userProfile.category && categoryMatches(userProfile.category, scholarship.tags.join(' '))) {
        matchScore += 30;
      } else if (!userProfile.category) {
        matchScore += 30; // No category filter = matches all
      }

      // Income matching (25 points)
      if (userProfile.income) {
        const maxIncomeStr = scholarship.reward.match(/₹[\d.]+/)?.[0] || '';
        const maxIncome = parseInt(maxIncomeStr.replace('₹', '')) * 100000 || 500000;
        if (incomeEligible(userProfile.income, maxIncome)) {
          matchScore += 25;
        }
      } else {
        matchScore += 25;
      }

      // CGPA matching (25 points)
      if (userProfile.cgpa && scholarship.tags.some(tag => tag.includes('+') || tag === 'Merit')) {
        // Rough estimate from tags
        matchScore += 25;
      } else if (!userProfile.cgpa) {
        matchScore += 25;
      }

      // Course matching (20 points)
      if (userProfile.course) {
        if (scholarship.tags.includes(userProfile.course) || scholarship.description.includes(userProfile.course)) {
          matchScore += 20;
        } else if (scholarship.tags.includes('Any') || scholarship.description.includes('Any')) {
          matchScore += 15;
        }
      } else {
        matchScore += 15;
      }

      return {
        ...scholarship,
        matchScore: Math.min(100, matchScore),
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}
