import { GoogleGenAI } from "@google/genai";
import { SCHOLARSHIPS_FROM_CSV } from './scholarshipsData';

interface UserProfile {
  fullName?: string;
  email?: string;
  phone?: string;
  course: string;
  category: string;
  income: string;
  cgpa: string;
  careerGoals?: string;
}

interface SearchFilters {
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
  category: string;
  reward: string;
  eligibility: string[];
  deadline: string;
  website: string;
  matchScore: number;
  source: 'ai_research' | 'csv_database';
  isFeatured?: boolean;
  aiInsight?: string;
  tags: string[];
}

// Format CSV scholarships as context for the AI
function formatCSVContext(): string {
  return SCHOLARSHIPS_FROM_CSV
    .slice(0, 15) // Top 15 scholarships from CSV
    .map((s, i) => `${i + 1}. ${s.title}: ${s.tags.join(', ')}`)
    .join('\n');
}

export async function searchScholarshipsWithAI(
  userProfile: Partial<UserProfile>,
  filters?: SearchFilters
): Promise<AIScholarship[]> {
  try {
    const apiKey = process.env.VITE_GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    
    if (!apiKey || apiKey === '') {
      console.warn("Gemini API key not configured. Using CSV database only.");
      return getScholarshipsFromCSV(userProfile, filters);
    }

    const ai = new GoogleGenAI({ apiKey });

    const userContext = `
User Profile:
- Course Level: ${userProfile.course || 'Not specified'}
- Category/Reservation: ${userProfile.category || 'General'}
- Annual Family Income: ${userProfile.income || 'Not specified'}
- CGPA/Academic Score: ${userProfile.cgpa || 'Not specified'}
- Career Goals: ${userProfile.careerGoals || 'Not specified'}

Search Filters:
- Scholarship Type: ${filters?.type || 'All'}
- Tags: ${filters?.tags?.join(', ') || 'None'}
`;

    const csvContext = formatCSVContext();

    const prompt = `You are an expert scholarship advisor. Based on the user profile below and the CSV database provided, search for and recommend relevant scholarships.

${userContext}

CSV Database Reference (for context):
${csvContext}

Your task:
1. Search for 10-15 real, current scholarships that match this user's profile
2. Include scholarships from the CSV database that match
3. Also research and suggest other major Indian scholarships the user qualifies for
4. IMPORTANT: When searching, apply the following type filter:
   - If 'State': Only include State Government scholarships
   - If 'Central': Only include Central Government and National scholarships
   - If 'Private': Only include Corporate CSR and Private Trust scholarships
   - If 'All': Include scholarships from all categories
5. For each scholarship, provide:
   - Title
   - Category (Government/Corporate/Private)
   - Key eligibility criteria
   - Approximate deadline
   - Official website/source
   - Match score (0-100 based on user eligibility)

Consider:
- Category-based scholarships (SC/ST/OBC/PWD/General)
- Merit-based scholarships
- Need-based scholarships (income criteria)
- Course-specific scholarships
- State/Central government scholarships
- Corporate CSR scholarships

Return ONLY a valid JSON array of scholarships in this format:
[
  {
    "title": "Scholarship Name",
    "description": "Brief description",
    "category": "Government/Corporate CSR/Private",
    "eligibility": ["Criterion 1", "Criterion 2"],
    "deadline": "DD-MMM-YYYY or 'Ongoing'",
    "website": "https://example.com",
    "matchScore": 85,
    "source": "ai_research"
  }
]

Make sure the JSON is valid and parseable.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    try {
      const recommendations = JSON.parse(response.text);
      
      // Ensure all items have required fields
      return (Array.isArray(recommendations) ? recommendations : [recommendations])
        .map((s, idx) => ({
          id: s.id || generateId(),
          title: s.title || 'Untitled Scholarship',
          description: s.description || s.eligibility?.join(', ') || 'A scholarship opportunity',
          category: s.category || 'Government',
          reward: s.reward || '₹50,000 - ₹2,00,000',
          eligibility: s.eligibility || [],
          deadline: s.deadline || 'Ongoing',
          website: s.website || 'https://scholarships.gov.in',
          matchScore: Math.min(100, Math.max(0, s.matchScore || 70)),
          source: 'ai_research' as const,
          isFeatured: idx === 0,
          aiInsight: `This scholarship aligns with your ${userProfile.course || 'academic'} profile and ${userProfile.category || 'background'}.`,
          tags: s.tags || []
        }))
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 20); // Limit to top 20
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return getScholarshipsFromCSV(userProfile, filters);
    }
  } catch (error) {
    console.error("AI scholarship search failed:", error);
    // Fallback to CSV database
    return getScholarshipsFromCSV(userProfile, filters);
  }
}

// Helper function to determine scholarship type
function getScholarshipType(scholarship: any): 'State' | 'Central' | 'Private' {
  const title = scholarship.title.toLowerCase();
  
  // Check if it's a corporate/private scholarship
  const privateCompanies = ['tata', 'aditya birla', 'google', 'adobe', 'flipkart', 'reliance', 'iocl', 'hdfc', 'lic', 'infosys', 'wipro', 'accenture', 'cognizant'];
  if (privateCompanies.some(company => title.includes(company))) {
    return 'Private';
  }
  
  // Check if it's a state program (has state name in scholarship or is state-specific)
  if (scholarship.state && scholarship.state !== 'All') {
    return 'State';
  }
  
  // Otherwise categorize as Central if it's a national scheme
  return 'Central';
}

// Generate unique ID
function generateId(): string {
  return `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Fallback: Filter scholarships from CSV database
function getScholarshipsFromCSV(
  userProfile: Partial<UserProfile>,
  filters?: SearchFilters
): AIScholarship[] {
  return SCHOLARSHIPS_FROM_CSV
    .filter(s => {
      // Filter by scholarship type if specified
      if (filters?.type && filters.type !== 'All') {
        const scholarshipType = getScholarshipType(s);
        if (scholarshipType !== filters.type) {
          return false;
        }
      }
      
      // Basic filtering based on profile
      if (userProfile.category && !s.tags.includes(userProfile.category)) {
        return s.tags.includes('General');
      }
      if (userProfile.course && !s.tags.includes(userProfile.course)) {
        return s.tags.some(tag => tag.includes(userProfile.course || ''));
      }
      return true;
    })
    .map((s, idx) => ({
      id: s.id || generateId(),
      title: s.title,
      description: s.description,
      category: s.category,
      reward: s.reward,
      eligibility: s.tags.slice(0, 3),
      deadline: s.deadline,
      website: 'https://scholarships.gov.in',
      matchScore: calculateMatchScore(s, userProfile, filters),
      source: 'csv_database' as const,
      isFeatured: idx === 0,
      aiInsight: `Based on CSV database: ${s.title} matches your criteria`,
      tags: s.tags
    }))
    .sort((a, b) => b.matchScore - a.matchScore);
}

// Calculate match score based on profile alignment
function calculateMatchScore(
  scholarship: any,
  userProfile: Partial<UserProfile>,
  filters?: SearchFilters
): number {
  let score = 50; // Base score

  // Category match
  if (userProfile.category && scholarship.tags.includes(userProfile.category)) {
    score += 20;
  } else if (scholarship.tags.includes('General')) {
    score += 15;
  }

  // Course match
  if (userProfile.course && scholarship.tags.includes(userProfile.course)) {
    score += 15;
  }

  // Income match
  if (userProfile.income && scholarship.tags.includes(userProfile.income)) {
    score += 10;
  }

  // Filter tags match
  if (filters?.tags?.length) {
    const matchingTags = filters.tags.filter(t => scholarship.tags.includes(t)).length;
    score += Math.min(matchingTags * 3, 10);
  }

  return Math.min(100, score);
}

// Get a mix of AI results and CSV results
export async function getHybridScholarships(
  userProfile: Partial<UserProfile>,
  filters?: SearchFilters
): Promise<AIScholarship[]> {
  try {
    // Try to get AI recommendations
    const aiResults = await searchScholarshipsWithAI(userProfile, filters);
    
    // Also get CSV results
    const csvResults = getScholarshipsFromCSV(userProfile, filters);
    
    // Merge and deduplicate based on title similarity
    const merged: AIScholarship[] = [];
    const seenTitles = new Set<string>();
    
    // Add top AI results first
    aiResults.slice(0, 12).forEach(s => {
      const normalizedTitle = s.title.toLowerCase().trim();
      if (!seenTitles.has(normalizedTitle)) {
        merged.push(s);
        seenTitles.add(normalizedTitle);
      }
    });
    
    // Add CSV results that aren't duplicates
    csvResults.slice(0, 8).forEach(s => {
      const normalizedTitle = s.title.toLowerCase().trim();
      if (!seenTitles.has(normalizedTitle)) {
        merged.push(s);
        seenTitles.add(normalizedTitle);
      }
    });
    
    return merged
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 15); // Top 15 combined
  } catch (error) {
    console.error("Hybrid search failed, using CSV only:", error);
    return getScholarshipsFromCSV(userProfile, filters);
  }
}
