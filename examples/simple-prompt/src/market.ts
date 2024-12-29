import { fereai } from 'fereai-provider';
import { generateText } from 'ai';

const { text } = await generateText({
  model: fereai('MarketAnalyzerAgent'),
  prompt: 'What has happened with $DEGEN?',
});

console.log(text);