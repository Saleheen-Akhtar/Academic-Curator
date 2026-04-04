const fs = require('fs');
let content = fs.readFileSync('./src/scholarshipsData.ts', 'utf8');

const oldStr = `export function filterScholarships(
  scholarships: Scholarship[],
  userProfile: Partial<UserProfile>,
  filters?: ScholarshipFilters
): Array<Scholarship & { matchScore: number; matchedBecause: string[] }> {`;

const newStr = `export function filterScholarships(
  scholarships: Scholarship[],
  userProfile: Partial<UserProfile>,
  filters?: ScholarshipFilters,
  mode: 'strict' | 'relaxed' = 'strict'
): Array<Scholarship & { matchScore: number; matchedBecause: string[] }> {`;

content = content.replace(oldStr, newStr);

const oldLogic = `      const failedHardEligibility =
        (categorySpecified && !categoryOk) ||
        (incomeSpecified && !incomeOk) ||
        (cgpaSpecified && !cgpaOk) ||
        (courseSpecified && !courseOk);

      const isEligible = !failedHardEligibility;`;

const newLogic = `      let isEligible = true;

      if (mode === 'strict') {
        const failedHardEligibility =
          (categorySpecified && !categoryOk) ||
          (incomeSpecified && !incomeOk) ||
          (cgpaSpecified && !cgpaOk) ||
          (courseSpecified && !courseOk);
        isEligible = !failedHardEligibility;
      } else {
        const matchesSomething = (categorySpecified ? categoryOk : true) ||
                                 (incomeSpecified ? incomeOk : true) ||
                                 (cgpaSpecified ? cgpaOk : true) ||
                                 (courseSpecified ? courseOk : true);

        const failedStrictCategory = categorySpecified && !categoryOk;

        isEligible = matchesSomething && !failedStrictCategory;
      }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('./src/scholarshipsData.ts', content);
console.log('patched');
