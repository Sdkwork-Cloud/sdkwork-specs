#!/usr/bin/env node
import fs from 'node:fs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node migrate-catalog-api-result-call-sites.mjs <router.rs> ...');
  process.exit(1);
}

for (const file of files) {
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(/CatalogApiResult, /g, '');
  text = text.replace(/, CatalogApiResult/g, '');
  text = text.replace(/Json\(CatalogApiResult::success\(\(\)\)\)\.into_response\(\)/g, 'success_accepted()');
  text = text.replace(/Json\(CatalogApiResult::success\(([^)]+)\)\)\.into_response\(\)/g, 'success_resource($1)');
  text = text.replace(
    /Json\(CatalogApiResult::success\(\s*([\s\S]*?)\s*\)\)\s*\.into_response\(\)/g,
    (_, body) => `success_list(${body.trim()})`,
  );
  text = text.replace(/success_list\((map_[a-z_]+\([^)]*\))\)/g, 'success_resource($1)');
  text = text.replace(/collect::<Vec<_>>\(\),\)/g, 'collect())');
  fs.writeFileSync(file, text);
  console.log(`migrated ${file}`);
}
