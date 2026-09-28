import fs from 'node:fs';
const resources = JSON.parse(fs.readFileSync('src/data/collegeResources.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('knowledge/manifest.json', 'utf8'));
const guides = resources.map(resource => {
  const page = manifest.find(p => p.url === resource.url && p.status === 'included');
  if (!page || !/^[a-z0-9-]+$/i.test(page.slug)) throw new Error('Missing approved guide page: ' + resource.title);
  const content = fs.readFileSync(`knowledge/pages/${page.slug}.md`, 'utf8').trim();
  // Preserve source wording; excerpts are visibly labeled, never represented as generated answers.
  const paragraphs = content.split(/\n\s*\n/).filter(p => !/^#+\s/.test(p) && !/^!\[/.test(p));
  let excerpt = '';
  for (const paragraph of paragraphs) {
    if ((excerpt + paragraph).length > 2200) break;
    excerpt += (excerpt ? '\n\n' : '') + paragraph;
  }
  return { ...resource, modified: page.modifiedGmt, excerpt: excerpt || 'Open the official page below to read the full information.' };
});
fs.writeFileSync('server/data/local-guide.json', JSON.stringify(guides, null, 2) + '\n');
console.log(`Built ${guides.length} local guide answers from the existing college snapshot.`);
