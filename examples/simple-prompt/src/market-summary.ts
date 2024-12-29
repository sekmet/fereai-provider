import { fereai } from 'fereai-provider';
import { generateText } from 'ai';

const { text } = await generateText({
  model: fereai('MarketAnalyzerAgent'),
  prompt: 'Give me a summary of the last 12 hours in the base network',
});

console.log(text);