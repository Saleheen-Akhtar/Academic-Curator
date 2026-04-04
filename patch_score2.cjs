const fs = require('fs');
let content = fs.readFileSync('./src/scholarshipsData.ts', 'utf8');

const oldComputeMatchScore = `function computeMatchScore(params: {
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
}`;

const newComputeMatchScore = `function computeMatchScore(params: {
  categoryOk: boolean;
  incomeOk: boolean;
  cgpaOk: boolean;
  courseOk: boolean;
}): number {
  let score = 0;
  if (params.categoryOk) score += 40;
  if (params.incomeOk) score += 30;
  if (params.cgpaOk) score += 20;
  if (params.courseOk) score += 10;
  return score;
}`;

content = content.replace(oldComputeMatchScore, newComputeMatchScore);

fs.writeFileSync('./src/scholarshipsData.ts', content);
console.log('patched score');
