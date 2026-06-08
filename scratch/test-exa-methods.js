import Exa from 'exa-js';
const exa = new Exa('dummy');
console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(exa)));
