const fs = require('fs');
let content = fs.readFileSync('./src/scholarshipAISearch.ts', 'utf8');

content = content.replace("async function fetchDynamicScholarships(): Promise<Scholarship[]> {", "export async function fetchDynamicScholarships(): Promise<Scholarship[]> {");

fs.writeFileSync('./src/scholarshipAISearch.ts', content);
console.log('exported fetchDynamicScholarships');
