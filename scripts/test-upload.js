#!/usr/bin/env node

/**
 * ──────────────────────────────────────────────────────────────────
 * Document Ingestion & RAG Test Utility
 * 
 * This script demonstrates and tests the Phase 3 RAG upload pipeline:
 *   1. Reads a local document (.pdf, .md, .txt, or .docx)
 *   2. Converts it to a Base64 string (as required by the tool's schema)
 *   3. Calls the `upload_document` tool API endpoint to ingest the file
 *   4. (Optional) Calls the `retrieve_documents` tool API endpoint to 
 *      query the vector store and verify that semantic search works.
 * 
 * Usage:
 *   node scripts/test-upload.js <path-to-file> [optional-search-query]
 * 
 * Example:
 *   node scripts/test-upload.js ./docs/AI\ Assessment.pdf "AI model"
 * ──────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';

// Define the port and endpoint URLs. The Hono server runs on 3141 by default.
const PORT = process.env.PORT || 3141;
const UPLOAD_API_URL = `http://localhost:${PORT}/tools/upload_document/execute`;
const RETRIEVE_API_URL = `http://localhost:${PORT}/tools/retrieve_documents/execute`;

async function main() {
  const args = process.argv.slice(2);
  const filePath = args[0];
  const query = args[1];

  if (!filePath) {
    console.error('Error: Please provide a file path to upload.');
    console.error('Usage: node scripts/test-upload.js <path-to-file> [optional-search-query]');
    console.error('Example: node scripts/test-upload.js ./data/seed/01-annual-strategy-2026.md "bridge to 2030"');
    process.exit(1);
  }

  // 1. Resolve path and verify file exists
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: File not found at ${absolutePath}`);
    process.exit(1);
  }

  const filename = path.basename(absolutePath);
  const stats = fs.statSync(absolutePath);
  
  console.log(`\n📄 Preparing document:`);
  console.log(`   - Name: ${filename}`);
  console.log(`   - Size: ${(stats.size / 1024).toFixed(2)} KB`);

  // 2. Read and encode file content to base64
  let base64Content;
  try {
    const fileBuffer = fs.readFileSync(absolutePath);
    base64Content = fileBuffer.toString('base64');
  } catch (error) {
    console.error(`Error reading file:`, error.message);
    process.exit(1);
  }

  // 3. Detect kind based on file extension
  const ext = path.extname(filename).toLowerCase();
  let kind;
  if (ext === '.pdf') kind = 'pdf';
  else if (ext === '.docx') kind = 'docx';
  else if (ext === '.md' || ext === '.markdown') kind = 'md';
  else if (ext === '.txt') kind = 'txt';
  else {
    console.warn(`⚠️ Unknown extension "${ext}". Defaulting to "txt".`);
    kind = 'txt';
  }

  // 4. Send upload request to the running Hono server
  console.log(`\n📤 Uploading and ingesting document...`);
  try {
    const response = await fetch(UPLOAD_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: {
          name: filename,
          content: base64Content,
          kind: kind
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    // In Hono + VoltAgent, the result is in: result.data.result
    const data = result.data?.result || result;

    console.log(`\n✅ Ingestion Successful!`);
    console.log(`   - Document ID : ${data.documentId}`);
    console.log(`   - Kind        : ${data.kind}`);
    console.log(`   - Chunks      : ${data.chunkCount}`);
    console.log(`   - Characters  : ${data.characterCount}`);
    
    if (data.preview && data.preview.length > 0) {
      console.log(`\n📖 Ingest Preview (First ${data.preview.length} chunks):`);
      data.preview.forEach((chunk, index) => {
        console.log(`   [Chunk ${index + 1}]: ${chunk.slice(0, 150)}${chunk.length > 150 ? '...' : ''}`);
      });
    }

    // 5. If a search query is provided, query the RAG layer
    if (query) {
      console.log(`\n🔍 Querying RAG layer with search term: "${query}"...`);
      // Brief pause to ensure vector storage write is complete
      await new Promise(resolve => setTimeout(resolve, 300));

      const queryResponse = await fetch(RETRIEVE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: {
            query: query,
            topK: 3
          }
        })
      });

      if (!queryResponse.ok) {
        const errorText = await queryResponse.text();
        throw new Error(`RAG retrieve failed: HTTP ${queryResponse.status}: ${errorText}`);
      }

      const queryResult = await queryResponse.json();
      const queryData = queryResult.data?.result || queryResult;

      console.log(`\n🎯 Retrieve Results:`);
      console.log(`   - Total Documents Indexed: ${queryData.totalDocuments}`);
      
      if (queryData.chunks && queryData.chunks.length > 0) {
        queryData.chunks.forEach((hit, index) => {
          console.log(`\n   [Hit #${index + 1}] Score: ${hit.score}`);
          console.log(`     Source : ${hit.documentName} (Chunk #${hit.chunkIndex})`);
          console.log(`     Excerpt: "${hit.excerpt}"`);
        });
      } else {
        console.log(`   ❌ No relevant chunks found for the query.`);
      }
    }
  } catch (error) {
    console.error(`\n❌ Pipeline Error:`, error);
    console.error(`Please ensure the CSO Intel Assistant dev server is running (usually 'npm run dev' on port 3141).`);
  }
}

main();
