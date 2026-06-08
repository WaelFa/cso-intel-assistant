import Exa from 'exa-js';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.EXA_API_KEY;
console.log('API Key exists:', !!apiKey);

const exa = new Exa(apiKey);

async function test() {
  try {
    const res = await exa.searchAndContents('digital assets market trends in Gulf region', {
      numResults: 2,
      highlights: true
    });
    console.log('Response status:', res ? 'success' : 'failed');
    console.log('Results length:', res.results?.length);
    if (res.results && res.results.length > 0) {
      const first = res.results[0];
      console.log('Result properties:', Object.keys(first));
      console.log('Title:', first.title);
      console.log('URL:', first.url);
      console.log('Published Date:', first.publishedDate);
      console.log('Highlights:', first.highlights);
      console.log('Text preview:', first.text ? first.text.substring(0, 100) : 'none');
    }
  } catch (e) {
    console.error('Error running search:', e);
  }
}

test();
