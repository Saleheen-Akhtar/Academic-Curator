# AI-Powered Scholarship Search Configuration

## Overview
The app now features AI-powered scholarship discovery that:
1. Uses Google Gemini 2.0 Flash to search for real scholarships online
2. References your CSV database as a knowledge base
3. Provides intelligent matching based on user profile
4. Falls back to CSV data if API is unavailable

## Setup Required

### 1. Get Your Gemini API Key
- Go to: https://ai.google.dev/tutorials/setup
- Create a free account or sign in
- Generate an API key for Gemini API

### 2. Add Environment Variable
Create or update your `.env` file in the project root:

```
VITE_GEMINI_API_KEY=your_api_key_here
```

### 3. Restart Dev Server
```bash
npm run dev
```

## How It Works

1. **User Profile + Search Filters** → Sent to Gemini AI
2. **Gemini AI** → 
   - Searches online for matching scholarships
   - References CSV database (32 scholarships)
   - Returns 10-15 recommendations with match scores
3. **Hybrid Results** →
   - AI results (primary)
   - CSV results (fallback if API fails)
   - Deduplicated and ranked by match score
4. **Display** → Shows scholarships with source indicator (AI or CSV)

## Features

✅ Real-time scholarship discovery from the web
✅ Intelligent matching based on:
   - Course level (10th, 12th, B.Tech, M.Tech, etc.)
   - Category (SC, ST, OBC, PWD, General)
   - Income level (< 1L, 1-2.5L, 2.5-5L)
   - CGPA/Academic score
   - Career goals alignment

✅ Automatic fallback to CSV database
✅ No recommendations lost if API fails
✅ Deduplication prevents duplicate results

## Testing Without API Key

The app will still work without the API key, using only the CSV database with the improved filtering logic. Install and test first, then add API integration for enhanced results.

## API Response Format

The Gemini API returns scholarships with:
- **title**: Scholarship name
- **description**: Brief summary
- **category**: Government/Corporate CSR/Private
- **eligibility**: Key criteria
- **deadline**: Application deadline
- **website**: Official website/source
- **matchScore**: 0-100 relevance score
- **source**: 'ai_research' or 'csv_database'
