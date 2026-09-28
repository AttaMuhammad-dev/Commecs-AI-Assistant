import 'dotenv/config';
import { readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { loadState, saveState } from './lib/indexState.js';
import { ensureStore, uploadToFileSearchStore } from './lib/fileSearchClient.js';
import { decodeEntities } from './lib/cleanHtml.js';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey && !process.argv.includes('--dry-run')) throw new Error("GEMINI_API_KEY is missing from the .env file.");

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const withPdfs = args.includes('--with-pdfs');
  const onlyArg = args.find(a => a.startsWith('--only='));
  const onlySlug = onlyArg ? onlyArg.split('=')[1] : null;

  const state = args.includes('--new-store') ? { documents: {} } as ReturnType<typeof loadState> : loadState();
  if (!dryRun && !args.includes('--confirm-indexing')) throw new Error('Indexing may incur embedding costs. Review index:dry, then pass --confirm-indexing explicitly.');
  if (!dryRun && Object.values(state.documents).some(d => !d.documentName.startsWith('fileSearchStores/'))) throw new Error('Legacy index state contains display names instead of document resource IDs. Use --new-store --confirm-indexing for a clean snapshot, then update FILE_SEARCH_STORE_NAME. The old store is preserved.');
  const storeName = dryRun ? "dry-run-store" : await ensureStore(apiKey!, state);
  console.log(`\nUsing store: ${storeName}\n`);

  const manifestPath = resolve(process.cwd(), 'knowledge', 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  const toUpload: any[] = [];
  let totalBytes = 0;

  // --- Text documents (pages + posts) ---
  for (const item of manifest) {
    if (item.status !== 'included') continue;
    if (onlySlug && item.slug !== onlySlug) continue;

    const folder = item.type === 'post' ? 'posts' : 'pages';
    const filePath = resolve(process.cwd(), 'knowledge', folder, `${item.slug}.md`);

    if (!existsSync(filePath)) {
      console.warn(`Skipping ${item.slug}: expected file not found at ${filePath}`);
      continue;
    }

    const content = readFileSync(filePath, 'utf-8');
    const hash = createHash('sha256').update(content).digest('hex');
    const cleanTitle = decodeEntities(item.title); // item.title is already a plain string

    if (force || !state.documents[item.slug] || state.documents[item.slug].contentHash !== hash) {
      toUpload.push({
        slug: item.slug,
        filePath,
        mimeType: 'text/markdown',
        displayName: cleanTitle,
        hash,
        type: item.type === 'post' ? 'post' : 'page',
        url: item.url, // was item.link — wrong field, always undefined
        modified: item.modifiedGmt,
        timeSensitive: item.timeSensitive ? 1 : 0,
      });
      totalBytes += statSync(filePath).size;
    }
  }

  // --- PDFs (curated allowlist) ---
  if (withPdfs && dryRun) console.log('Dry run: curated PDFs would be checked/uploaded; no files downloaded.');
  if (withPdfs && !dryRun) {
    const pdfAllowlistPath = resolve(process.cwd(), 'scripts', 'pdf-allowlist.json');
    const pdfs = JSON.parse(readFileSync(pdfAllowlistPath, 'utf-8'));

    if (pdfs.length > 25) throw new Error("PDF allowlist exceeds the hard cap of 25 documents.");
    for (const pdf of pdfs) {
      const u = new URL(pdf.url);
      if (u.protocol !== 'https:' || u.hostname !== 'commecscollege.edu.pk') {
        throw new Error(`SECURITY VIOLATION: Invalid PDF host ${u.hostname}`);
      }
    }

    const tempDir = resolve(process.cwd(), 'knowledge', '.tmp-pdfs');
    if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });

    for (const pdf of pdfs) {
      const urlHash = createHash('sha256').update(pdf.url).digest('hex');
      const slug = `pdf:${urlHash}`;

      if (!force && state.documents[slug]) continue;

      console.log(`Downloading PDF: ${pdf.title}...`);
      const res = await fetch(pdf.url, { signal: AbortSignal.timeout(30000), redirect: 'error', headers: { 'User-Agent': 'CommecsChatbotIngest/1.0' } });
      if (!res.ok) {
        console.error(`Failed to download ${pdf.title}: HTTP ${res.status}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > 100 * 1024 * 1024) {
        console.error(`Skipping ${pdf.title}: exceeds 100MB File Search limit`);
        continue;
      }

      const tmpPath = resolve(tempDir, `${urlHash}.pdf`);
      writeFileSync(tmpPath, buf);

      toUpload.push({
        slug,
        filePath: tmpPath,
        mimeType: 'application/pdf',
        displayName: pdf.title,
        hash: urlHash,
        type: 'pdf',
        url: pdf.url,
        modified: new Date().toISOString(),
        timeSensitive: 0,
      });
      totalBytes += buf.byteLength;
    }
  }

  if (toUpload.length > 0) {
    const tokenEstimate = Math.round(totalBytes / 4);
    console.log(`Ready to index ${toUpload.length} document(s). Total payload approx ${totalBytes} bytes (~${tokenEstimate} tokens).`);
    console.log(`Embeddings are billed once at this step.\n`);
    if (totalBytes > 5 * 1024 * 1024 && !args.includes('--yes')) {
      console.error("Payload exceeds 5MB. Re-run with --yes to confirm.");
      process.exit(1);
    }
  } else {
    console.log("Everything is up to date. Nothing to upload.");
  }

  if (dryRun) {
    console.log(`Dry run complete. Would process: ${toUpload.map(d => d.slug).join(', ') || '(none)'}`);
    return;
  }

  if (toUpload.some(doc => state.documents[doc.slug])) throw new Error('Changed documents require --new-store --confirm-indexing to avoid mixing obsolete and current policies. The old store is preserved.');
  let created = 0, updated = 0, failed = 0;

  for (const doc of toUpload) {
    const isUpdate = !!state.documents[doc.slug];
    console.log(`${isUpdate ? 'Updating' : 'Uploading'} ${doc.slug}...`);
    try {
      const metadata = {
        url: doc.url,
        title: doc.displayName,
        slug: doc.slug,
        modified: doc.modified,
        type: doc.type,
        time_sensitive: doc.timeSensitive,
      };
      const documentName = await uploadToFileSearchStore(
        apiKey!, storeName, doc.filePath, doc.mimeType, doc.displayName, metadata
      );
      state.documents[doc.slug] = {
        documentName: documentName as string,
        contentHash: doc.hash,
        modifiedGmt: doc.modified,
      };
      saveState(state);
      isUpdate ? updated++ : created++;
    } catch (err: any) {
      console.error(`Failed ${doc.slug}: ${err.message}`);
      failed++;
    }
  }

  if (created + updated > 0) state.lastRun = new Date().toISOString();
  saveState(state);

  console.log(`\nDone. Created: ${created}, Updated: ${updated}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});