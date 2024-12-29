# FereAI Provider for the Vercel AI SDK

The **[FereAI Provider](https://github.com/sekmet/fereai-provider)** for the [Vercel AI SDK](https://sdk.vercel.ai/docs)
contains language model support for the FereAI APIs.

## Requirements

This provider requires FereAI UserId and API Key to be set in the function configuration. You can set them too in the `FEREAI_USER_ID` and `FEREAI_API_KEY` environment variables.

## Setup

The FereAI provider is available in the `fereai-provider` module. You can install it with

```bash
npm i fereai-provider
```

or

```bash
pnpm add fereai-provider
```

or

```bash
yarn add fereai-provider
```


## Provider Instance

You can import the default provider instance `fereai` from `fereai-provider`:

```ts
import { fereai } from 'fereai-provider';
```

## Example

```ts
import { fereai } from 'fereai-provider';
import { generateText } from 'ai';

const { text } = await generateText({
  model: fereai('ProAgent'),
  prompt: 'Please tell me which ones would be a good buy in the current environment',
});
```

## Documentation

Please check out the **[FereAI provider documentation](https://github.com/sekmet/fereai-provider)** for more information.