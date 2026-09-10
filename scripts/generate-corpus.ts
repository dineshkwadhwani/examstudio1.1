#!/usr/bin/env node
/**
 * Corpus Generator
 * ─────────────────
 * Generates 5 static HTML pages comprising ~250,000 words total.
 * Outputs to public/corpus/ and emits a reference-table.json
 * that you upload to the exam session via the SA dashboard.
 *
 * Run: npx ts-node --project tsconfig.node.json scripts/generate-corpus.ts
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// ─── AI/ML word pool ─────────────────────────────────────────
// Technical vocabulary relevant to the F0003 course
const WORD_POOL = [
  'agent','model','data','train','neural','network','layer','node','weight','bias',
  'gradient','learning','inference','prompt','token','embedding','vector','matrix',
  'attention','transformer','encoder','decoder','context','retrieval','augmented',
  'generation','pipeline','chunk','index','query','similarity','cosine','distance',
  'corpus','document','sentence','paragraph','feature','classification','regression',
  'prediction','output','input','batch','epoch','loss','accuracy','precision','recall',
  'evaluation','benchmark','deployment','inference','latency','throughput','memory',
  'compute','parameter','hyperparameter','optimizer','scheduler','checkpoint','finetune',
  'pretrain','adaptation','instruction','alignment','safety','guardrail','hallucination',
  'grounding','citation','source','evidence','reasoning','chain','thought','planning',
  'action','observation','reward','policy','environment','state','transition','episode',
  'workflow','automation','orchestration','tool','function','calling','execution','result',
  'feedback','iteration','convergence','divergence','regularization','dropout','activation',
  'softmax','relu','sigmoid','normalization','pooling','convolution','recurrent','sequence',
  'streaming','chunking','splitting','merging','filtering','ranking','scoring','threshold',
  'confidence','uncertainty','calibration','robustness','generalization','overfitting',
  'underfitting','variance','bias','dataset','annotation','labeling','synthetic','augmentation',
  'preprocessing','tokenization','vocabulary','subword','wordpiece','sentencepiece','byte',
  'pair','encoding','decoding','beam','search','sampling','temperature','topp','topk',
  'system','message','assistant','human','role','content','format','structure','schema',
  'json','xml','markdown','plain','text','image','multimodal','vision','audio','speech',
  'recognition','synthesis','translation','summarization','extraction','question','answer',
  'retrieval','search','semantic','lexical','hybrid','dense','sparse','reranking','fusion',
  'agentic','autonomous','planning','execution','monitoring','logging','debugging','testing',
  'validation','verification','certification','compliance','audit','governance','ethics',
  'fairness','transparency','explainability','interpretability','accountability','trust',
]

const PAGE_TITLES = [
  'Introduction to Retrieval-Augmented Generation',
  'Vector Databases and Semantic Search',
  'Agentic AI Systems and Tool Use',
  'Building Autonomous Workflows with Apify',
  'Evaluation and Deployment of AI Pipelines',
]

const WORDS_PER_PAGE = 50_000  // 5 pages × 50K = 250K
const OUT_DIR = path.join(process.cwd(), 'public', 'corpus')

// ─── Seeded PRNG ─────────────────────────────────────────────
function makeRng(seed: string) {
  let state = BigInt('0x' + crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16))
  return function next() {
    state = (state * 6364136223846793005n + 1442695040888963407n) & 0xFFFFFFFFFFFFFFFFn
    return Number(state & 0x7FFFFFFFFFFFFFFFn) / Number(0x7FFFFFFFFFFFFFFFn)
  }
}

function pickWord(rng: () => number): string {
  return WORD_POOL[Math.floor(rng() * WORD_POOL.length)]
}

function generatePageText(rng: () => number, wordCount: number): string {
  const words: string[] = []
  for (let i = 0; i < wordCount; i++) {
    words.push(pickWord(rng))
  }
  return words.join(' ')
}

function wrapInHtml(pageNo: number, title: string, bodyText: string): string {
  // Split text into paragraphs of ~150 words each
  const wordArr = bodyText.split(' ')
  const paraSize = 150
  const paragraphs: string[] = []
  for (let i = 0; i < wordArr.length; i += paraSize) {
    const para = wordArr.slice(i, i + paraSize).join(' ')
    paragraphs.push(`<p>${para}</p>`)
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Page ${pageNo}: ${title}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.7; color: #333; }
    h1 { font-size: 1.8rem; color: #1a1a2e; border-bottom: 2px solid #4a90d9; padding-bottom: 0.5rem; }
    nav { margin-bottom: 2rem; }
    nav a { margin-right: 1rem; color: #4a90d9; text-decoration: none; }
    nav a:hover { text-decoration: underline; }
    p { margin-bottom: 1rem; text-align: justify; }
    .page-indicator { color: #888; font-size: 0.9rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <nav>
    ${[1,2,3,4,5].map(i => `<a href="page${i}.html">Page ${i}</a>`).join('')}
    | <a href="index.html">Index</a>
  </nav>
  <h1>${title}</h1>
  <p class="page-indicator">Page ${pageNo} of 5 — Corpus for F0003 CA1 Examination</p>
  ${paragraphs.join('\n  ')}
</body>
</html>`
}

// ─── Count words ─────────────────────────────────────────────
function countWords(text: string): Map<string, number> {
  const counts = new Map<string, number>()
  const words = text.toLowerCase().split(/\s+/).filter(Boolean)
  for (const word of words) {
    const clean = word.replace(/[^a-z]/g, '')
    if (clean) counts.set(clean, (counts.get(clean) ?? 0) + 1)
  }
  return counts
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const rng = makeRng('corpus-seed-f0003-ca1-2026')

  const pageTexts: string[] = []
  const pageWordCounts: Map<string, number>[] = []

  console.log('Generating corpus pages…')

  for (let p = 1; p <= 5; p++) {
    const title = PAGE_TITLES[p - 1]
    const text = generatePageText(rng, WORDS_PER_PAGE)
    const html = wrapInHtml(p, title, text)
    const filename = `page${p}.html`
    const outPath = path.join(OUT_DIR, filename)
    fs.writeFileSync(outPath, html, 'utf8')
    pageTexts.push(text)
    pageWordCounts.push(countWords(text))
    console.log(`  ✓ page${p}.html — ${WORDS_PER_PAGE.toLocaleString()} words — SHA256: ${sha256(html).slice(0, 8)}…`)
  }

  // Build index page
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>F0003 CA1 Corpus — Index</title>
  <style>
    body { font-family: Georgia, serif; max-width: 600px; margin: 4rem auto; padding: 2rem; color: #333; }
    h1 { font-size: 1.5rem; color: #1a1a2e; }
    ul { list-style: none; padding: 0; }
    li { margin: 0.8rem 0; }
    a { color: #4a90d9; text-decoration: none; font-size: 1.1rem; }
    a:hover { text-decoration: underline; }
    p { color: #666; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>📚 F0003 CA1 Corpus</h1>
  <p>Autonomous AI Systems and Agent-Based Computing — Examination Corpus</p>
  <p>Total: ${(5 * WORDS_PER_PAGE).toLocaleString()} words across 5 pages</p>
  <ul>
    ${PAGE_TITLES.map((t, i) => `<li><a href="page${i+1}.html">Page ${i+1}: ${t}</a></li>`).join('\n    ')}
  </ul>
</body>
</html>`

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), indexHtml, 'utf8')
  console.log('  ✓ index.html')

  // Build reference table
  console.log('\nBuilding reference table…')
  const referenceTable: Record<string, { total: number; pages: Record<number, number> }> = {}

  const allWords = new Set<string>()
  for (const wc of pageWordCounts) {
    for (const word of wc.keys()) allWords.add(word)
  }

  let totalWords = 0
  for (const word of allWords) {
    const pages: Record<number, number> = {}
    let total = 0
    for (let p = 0; p < 5; p++) {
      const count = pageWordCounts[p].get(word) ?? 0
      if (count > 0) pages[p + 1] = count
      total += count
    }
    if (total > 0) {
      referenceTable[word] = { total, pages }
      totalWords += total
    }
  }

  const refTablePath = path.join(OUT_DIR, 'reference-table.json')
  fs.writeFileSync(refTablePath, JSON.stringify(referenceTable, null, 2), 'utf8')

  const manifest = [1,2,3,4,5].map(p => {
    const filename = `page${p}.html`
    const html = fs.readFileSync(path.join(OUT_DIR, filename), 'utf8')
    return { filename, url: `/corpus/${filename}`, hash: sha256(html), page_no: p }
  })

  const manifestPath = path.join(OUT_DIR, 'manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

  console.log(`\n✅ Corpus generated:`)
  console.log(`   Output: ${OUT_DIR}`)
  console.log(`   Total words: ${totalWords.toLocaleString()}`)
  console.log(`   Unique words: ${Object.keys(referenceTable).length.toLocaleString()}`)
  console.log(`   Reference table: ${refTablePath}`)
  console.log(`   Manifest: ${manifestPath}`)
  console.log(`\nNext steps:`)
  console.log(`  1. The public/corpus/ files are served automatically by Next.js/Vercel`)
  console.log(`  2. In the SA Dashboard → select your session → "Set Reference Table"`)
  console.log(`  3. Paste the contents of reference-table.json into the field`)
  console.log(`  4. Also paste manifest.json into the corpus_manifest field`)
}

main().catch(console.error)
