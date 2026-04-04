const fs = require('fs');
let content = fs.readFileSync('./src/scholarshipsData.ts', 'utf8');

const oldCourse = `function courseRelevant(userCourse: string, scholarshipCourse: string | undefined): boolean {
  if (!userCourse || !scholarshipCourse || scholarshipCourse === 'Any') return true;
  const normalizedUserCourse = userCourse.toLowerCase();
  return splitTokens(scholarshipCourse)
    .map(token => token.toLowerCase())
    .some(token => normalizedUserCourse.includes(token) || token.includes(normalizedUserCourse));
}`;

const newCourse = `function courseRelevant(userCourse: string, scholarshipCourse: string | undefined): boolean {
  if (!userCourse || !scholarshipCourse || scholarshipCourse === 'Any') return true;
  const normalizedUserCourse = userCourse.toLowerCase().trim();

  // Try split match first
  const hasMatch = splitTokens(scholarshipCourse)
    .map(token => token.toLowerCase())
    .some(token => normalizedUserCourse.includes(token) || token.includes(normalizedUserCourse));

  if (hasMatch) return true;

  // Extra relaxed checks: if user types "10th" or "12th" or "school" we check common mappings
  const mapped = [];
  if (normalizedUserCourse.includes("10th") || normalizedUserCourse.includes("12th") || normalizedUserCourse.includes("school")) {
    mapped.push("school");
    mapped.push("class");
    mapped.push("pre-matric");
    mapped.push("post-matric");
  }

  const normScholarshipCourse = scholarshipCourse.toLowerCase();
  return mapped.some(m => normScholarshipCourse.includes(m));
}`;

content = content.replace(oldCourse, newCourse);

// Add missing method if any issues
const oldMatches = `        const matchesSomething = (categorySpecified ? categoryOk : true) ||
                                 (incomeSpecified ? incomeOk : true) ||
                                 (cgpaSpecified ? cgpaOk : true) ||
                                 (courseSpecified ? courseOk : true);`;

const newMatches = `        const hasSpecifiedCriteria = categorySpecified || incomeSpecified || cgpaSpecified || courseSpecified;
        const matchesSomething = (categorySpecified ? categoryOk : false) ||
                                 (incomeSpecified ? incomeOk : false) ||
                                 (cgpaSpecified ? cgpaOk : false) ||
                                 (courseSpecified ? courseOk : false);`;

content = content.replace(oldMatches, newMatches);

const oldIsEligible = `        isEligible = matchesSomething && !failedStrictCategory;`;
const newIsEligible = `        isEligible = (hasSpecifiedCriteria ? matchesSomething : true) && !failedStrictCategory;`;
content = content.replace(oldIsEligible, newIsEligible);

fs.writeFileSync('./src/scholarshipsData.ts', content);
console.log('patched');
