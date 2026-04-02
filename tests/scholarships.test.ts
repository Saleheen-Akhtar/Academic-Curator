import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

(globalThis as any).__SCHOLARSHIPS_CSV__ = readFileSync('scholarships.csv', 'utf8');

const dataModule = await import('../src/scholarshipsData');
const aiModule = await import('../src/scholarshipAISearch');

const { filterScholarships, getScholarshipsFromCSV } = dataModule;
const { getHybridScholarships } = aiModule;
type Scholarship = any;

function makeScholarship(overrides: Partial<Scholarship> = {}): Scholarship {
  return {
    id: '1',
    title: 'Sample Scholarship',
    description: 'Test scholarship',
    reward: 'Varies',
    deadline: '31 Dec',
    category: 'Government',
    tags: [],
    state: 'All',
    link: 'https://example.org',
    maxIncome: 250000,
    minCgpa: 6,
    course: 'Engineering',
    categoryRaw: 'All',
    scholarshipType: 'Central',
    ...overrides,
  };
}

test('category mappings support SC/ST/OBC/General/PWD/Girls/Minority', () => {
  const scholarships = [
    makeScholarship({ id: 'sc', categoryRaw: 'SC/ST' }),
    makeScholarship({ id: 'obc', categoryRaw: 'SC/ST/OBC' }),
    makeScholarship({ id: 'general', categoryRaw: 'All' }),
    makeScholarship({ id: 'pwd', categoryRaw: 'Disabled' }),
    makeScholarship({ id: 'girls', categoryRaw: 'Girls' }),
    makeScholarship({ id: 'minority', categoryRaw: 'Minority' }),
  ];

  const sc = filterScholarships(scholarships, { category: 'SC', course: 'Engineering', income: '< 1L', cgpa: '8+' });
  const pwd = filterScholarships(scholarships, { category: 'PWD', course: 'Engineering', income: '< 1L', cgpa: '8+' });
  const girls = filterScholarships(scholarships, { category: 'Girls', course: 'Engineering', income: '< 1L', cgpa: '8+' });

  assert.ok(sc.some(s => s.id === 'sc'));
  assert.ok(sc.some(s => s.id === 'minority'));
  assert.ok(pwd.some(s => s.id === 'pwd'));
  assert.ok(girls.some(s => s.id === 'girls'));
});

test('income thresholds are enforced', () => {
  const scholarships = [makeScholarship({ id: 'low', maxIncome: 150000 }), makeScholarship({ id: 'high', maxIncome: 500000 })];
  const result = filterScholarships(scholarships, { income: '2.5 - 5L', category: 'General', course: 'Engineering', cgpa: '8+' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'high');
});

test('CGPA merit thresholds are enforced', () => {
  const scholarships = [makeScholarship({ id: 'strict', minCgpa: 8 }), makeScholarship({ id: 'lenient', minCgpa: 6 })];
  const result = filterScholarships(scholarships, { cgpa: '7+', category: 'General', course: 'Engineering', income: '< 1L' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'lenient');
});

test('type filter is applied correctly after eligibility', () => {
  const scholarships = [
    makeScholarship({ id: 'state', scholarshipType: 'State', state: 'Karnataka' }),
    makeScholarship({ id: 'central', scholarshipType: 'Central' }),
    makeScholarship({ id: 'private', scholarshipType: 'Private', category: 'Private' }),
  ];

  const stateOnly = filterScholarships(scholarships, { category: 'General', course: 'Engineering', income: '< 1L', cgpa: '8+' }, { type: 'State' });
  assert.deepEqual(stateOnly.map(s => s.id), ['state']);
});

test('hybrid search dedupes by normalized title + website across csv and web', async () => {
  process.env.VITE_SCHOLARSHIP_RETRIEVAL_URL = 'https://retrieval.local/search';

  const csv = getScholarshipsFromCSV()[0];
  const duplicateTitle = csv.title;
  const duplicateWebsite = csv.link || 'https://scholarships.gov.in';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return {
      ok: true,
      json: async () => ([
        {
          title: duplicateTitle,
          description: 'Duplicate web record',
          website: duplicateWebsite,
          categoryRaw: 'All',
          course: 'Any',
          state: 'All',
          maxIncome: 999999,
          minCgpa: 5,
        },
      ]),
    } as any;
  }) as any;

  try {
    const result = await getHybridScholarships({ category: 'General', course: '', income: '', cgpa: '' }, { course: '', category: 'General', income: '', cgpa: '', type: 'All', tags: [] });
    const keys = result.map(r => `${r.title.toLowerCase().trim()}|${r.website.toLowerCase().trim()}`);
    assert.equal(keys.length, new Set(keys).size);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.VITE_SCHOLARSHIP_RETRIEVAL_URL;
  }
});

test('regression: csv updates are loaded by runtime parser (csv is source of truth)', () => {
  const data = getScholarshipsFromCSV();
  assert.ok(data.length > 0);
  assert.ok(data.some(item => item.title === 'NSP Scholarship'));
});

test('integration: hybrid search returns csv matches even if internet retrieval fails', async () => {
  process.env.VITE_SCHOLARSHIP_RETRIEVAL_URL = 'https://retrieval.local/search';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('network down');
  }) as any;

  try {
    const result = await getHybridScholarships(
      { category: 'General', course: 'Engineering', income: '< 1L', cgpa: '7+' },
      { course: 'Engineering', category: 'General', income: '< 1L', cgpa: '7+', type: 'All', tags: [] },
    );
    assert.ok(result.length > 0);
    assert.ok(result.every(item => item.source === 'csv_database' || item.source === 'ai_augmented'));
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.VITE_SCHOLARSHIP_RETRIEVAL_URL;
  }
});
