import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

try {
  console.log('Attempting to require pdf-parse...');
  const pdfParse = require('pdf-parse');
  console.log('Success! pdf-parse required without throwing error.');
} catch (error) {
  console.error('Failed to require pdf-parse:', error.message);
}
