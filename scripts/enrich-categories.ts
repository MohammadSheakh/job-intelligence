import 'dotenv/config';
import { suggestCategories } from '../src/categories/enrichment.js';
import { addCompanyCategories, listOtherCompanies } from '../src/repositories/categories.js';

const apply = process.argv.includes('--apply');
const limitArg = process.argv.find(v => v.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;
const thresholdArg = process.argv.find(v => v.startsWith('--threshold='));
const threshold = thresholdArg ? Number(thresholdArg.split('=')[1]) : 0.85;

const companies = await listOtherCompanies(limit);
let companiesWithSuggestions = 0;
let suggestionCount = 0;

for (const company of companies) {
  const suggestions = suggestCategories(company).filter(s => s.confidence >= threshold && s.name !== 'Other');
  if (!suggestions.length) continue;
  companiesWithSuggestions++;
  suggestionCount += suggestions.length;
  console.log(`\n${company.id} ${company.name}`);
  for (const s of suggestions) console.log(`  - ${s.name} ${(s.confidence * 100).toFixed(0)}% (${s.reason})`);
  if (apply) await addCompanyCategories(company.id, suggestions.map(s => s.name), 'rule_inferred');
}

console.log(`\nScanned: ${companies.length}`);
console.log(`Companies with suggestions: ${companiesWithSuggestions}`);
console.log(`Suggestions: ${suggestionCount}`);
console.log(apply ? 'Applied suggestions.' : 'Dry run only. Re-run with --apply to write assignments.');
