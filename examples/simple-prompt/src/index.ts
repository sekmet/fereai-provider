import { fereai } from 'fereai-provider';
import { generateText } from 'ai';

const { text } = await generateText({
  model: fereai('ProAgent'),
  prompt: 'Give me a summary of the latest crypto news today',
});

console.log(text);