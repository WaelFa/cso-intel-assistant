import Exa from 'exa-js';
console.log('Exa class:', Exa);
try {
  const exa = new Exa('dummy-key');
  console.log('Exa instance created successfully:', typeof exa.search);
} catch (e) {
  console.error('Error instantiating Exa:', e);
}
