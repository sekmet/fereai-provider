import { 
    LanguageModelV1,
    LanguageModelV1CallOptions,
    LanguageModelV1CallWarning,
    LanguageModelV1FinishReason,
    LanguageModelV1FunctionToolCall,
    LanguageModelV1LogProbs,
    LanguageModelV1StreamPart,
    UnsupportedFunctionalityError,
    ProviderV1 
} from '@ai-sdk/provider';
import { withoutTrailingSlash } from '@ai-sdk/provider-utils';
import { isPromptRelatedTo, hasKeyword } from './helpers';
import WebSocket from 'ws';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import dotenv from 'dotenv';

dotenv.config();

// Type definitions for FereAI models and responses
export type FereAIModelId = 'ProAgent' | 'MarketAnalyzerAgent' | 'Casso';

export interface FereAIMarketAnalyzerSummaryResponse {
  chat_id: string;
  summary: string;
  agent_version: string;
  agent_api_name: string;
  query_summary: string;
  is_summary: boolean;
  agent_credits: number;
  credits_available: number;
}

export interface FereAIChatResponse {
  answer: string;
  chat_id: string;
  representation: any[];
  agent_api_name: string;
  query_summary: string;
  agent_credits: number;
  credits_available: number;
}

export interface FereAIChatSettings {
  contextDuration?: number;
  parentId?: string;
  stream?: boolean;
  debug?: boolean;
}

export interface FereAIProviderSettings {
  /**
   * Base URL for FereAI API calls
   */
  baseURL?: string;
  /**
   * API Key for authentication
   */
  apiKey?: string;
  /**
   * User ID for authentication
   */
  userId?: string;
  /**
   * Custom fetch implementation
   */
  fetch?: typeof fetch;
  /**
   * Custom headers
   */
  headers?: Record<string, string>;
  /**
   * Debug mode
   */
  debug?: boolean;
}

// Main FereAI Chat Language Model implementation
export class FereAIChatLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = 'v1';
  readonly provider = 'fereai';
  readonly defaultObjectGenerationMode = 'json';
  private readonly baseURL: string;
  private readonly headers: () => Record<string, string>;
  readonly modelId: FereAIModelId;
  private readonly settings: FereAIChatSettings;
  readonly options: any;

  constructor(
    modelId: FereAIModelId,
    settings: FereAIChatSettings = {},
    options: {
      baseURL: string;
      headers: () => Record<string, string>;
      provider: string;
    }
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.baseURL = options.baseURL;
    this.headers = options.headers;
    this.options = options;
  }
  
  private getWebSocketUrl(userPrompt: string): string {
    const apiKey = process.env.FEREAI_API_KEY ?? this.options.apiKey;
    const userId = process.env.FEREAI_USER_ID ?? this.options.userId;
    const baseUrl = this.baseURL;

    if (!apiKey || !userId || !baseUrl) {
      throw new Error('Missing required API configuration');
    }

    switch (this.modelId) {
      case 'ProAgent':
        return `wss://${baseUrl}/chat/v2/ws/${userId}?X-FRIDAY-KEY=${apiKey}`;
      case 'MarketAnalyzerAgent':
        const isSummaryRelated = isPromptRelatedTo([
            'generate summary', 
            'create summary', 
            'build summary', 
            'provide summary', 
            'produce summary', 
            'compile summary', 
            'draft summary', 
            'prepare summary', 
            'write summary', 
            'deliver summary', 
            'offer summary',
            'summary of the latest',
            'summary of the last',
            'summarize the market'
        ], 0.6); // You can adjust the threshold as needed);
        if (this.settings.debug) {
            console.log('User Prompt:', userPrompt,"\n");
            console.log('Is Summary Related?', isSummaryRelated(userPrompt),"\n")
        }
        switch (isSummaryRelated(userPrompt)) {
          case true:
            return `wss://${baseUrl}/ws/generate_summary/${userId}?X-FRIDAY-KEY=${apiKey}`;
          case false:
            return `wss://${baseUrl}/chat/v1/ws/${userId}?X-FRIDAY-KEY=${apiKey}`;
        }
      default:
        throw new Error(`Unsupported agent: ${this.modelId}`);
    }
  }

  private createPayload(message: string) {
    const userTime = this.getUserTime();

    return {
      agent: this.modelId,
      stream: this.settings.stream ?? true,
      user_time: userTime.format(),
      x_hours: this.settings.contextDuration ?? 1,
      parent: this.settings.parentId === '0' ? 0 : this.settings.parentId ?? 0,
      message
    };
  }

  private getUserTime() {
    dayjs.extend(utc);
    dayjs.extend(timezone);
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const currentTimestamp = Date.now();
    return dayjs(currentTimestamp).tz(userTimezone);
  }

  private isValidResponse(value: unknown): value is FereAIChatResponse {
    return (
      typeof value === 'object' &&
      value !== null &&
      'answer' in value &&
      typeof (value as any).answer === 'string'
    );
  }


  async doGenerate(options: LanguageModelV1CallOptions): Promise<{
    text?: string;
    toolCalls?: LanguageModelV1FunctionToolCall[];
    finishReason: LanguageModelV1FinishReason;
    usage: { promptTokens: number; completionTokens: number };
    rawCall: { rawPrompt: unknown; rawSettings: Record<string, unknown> };
    rawResponse?: { headers?: Record<string, string> };
    warnings?: LanguageModelV1CallWarning[];
    logprobs?: LanguageModelV1LogProbs;
  }> {
    // Extract the last user message
    const lastMessage = options.prompt as any;
    // Create WebSocket connection and handle response
    return new Promise((resolve, reject) => {
      const userPrompt = lastMessage[0].content[0].text;
      const wsUrl = this.getWebSocketUrl(userPrompt);
      // check if the url is valid generate_summary
      const isSummaryUrl = hasKeyword('generate_summary');
      const websocket = new WebSocket(wsUrl);

      let responseData: FereAIChatResponse | FereAIMarketAnalyzerSummaryResponse | null = null;
      // Type narrowing based on the URL
      if (isSummaryUrl(wsUrl) && this.modelId === 'MarketAnalyzerAgent') {
          type ResponseType = FereAIMarketAnalyzerSummaryResponse | null;
          responseData = null as ResponseType;
      } else {
          type ResponseType = FereAIChatResponse | null;
          responseData = null as ResponseType;
      }
      
      websocket.on('open', () => {
        if (this.settings.debug) {
            console.log('WebSocket connection opened [Prompt]:', lastMessage[0].content[0].text);
        }
        const payload = this.createPayload(lastMessage[0].content[0].text);
        if (this.settings.debug) {
            console.log('Sending payload:', JSON.stringify(payload, null, 2));
        }
        websocket.send(JSON.stringify(payload));
      });

      websocket.on('message', (data: WebSocket.Data) => {
        try {
          const message = data.toString();
          if (message.trim().startsWith('{')) {
            const response = JSON.parse(message);
            if (this.isValidResponse(response) && !isSummaryUrl(wsUrl)) {
              responseData = response as FereAIChatResponse;
            } else {
              responseData = response as FereAIMarketAnalyzerSummaryResponse;
            }
          }
          if (this.settings.debug) {
            console.log('Received message:', message,"\n");
          }
        } catch (error) {
          reject(error);
          websocket.close();
        }
      });

      websocket.on('error', (error: Error) => {
        reject(error);
        websocket.close();
      });

      websocket.on('close', () => {
        if (responseData) {
          if (this.settings.debug) {
            console.log('Received response:', responseData,"\n");
          }
          let result: any = null;

          if (this.modelId === 'MarketAnalyzerAgent') {
            if (this.settings.debug) {
                console.log('wsUrl:', wsUrl);
                console.log('Is summary url?:', isSummaryUrl(wsUrl),"\n");
            }
            if (isSummaryUrl(wsUrl)) {
                const responseDataSummary = responseData as FereAIMarketAnalyzerSummaryResponse;
                if (this.settings.debug) {
                    console.log('Received response summary:', responseDataSummary,"\n");
                }
                result = {
                    text: responseDataSummary.summary,
                    finishReason: 'stop',
                    usage: { promptTokens: 0, completionTokens: 0 },
                    rawCall: { rawPrompt: options.prompt, rawSettings: this.options },
                };            
            } else {
                const responseDataChat = responseData as FereAIChatResponse;
                if (this.settings.debug) {
                    console.log('Received response chat:', responseDataChat,"\n");
                }
                result = {
                    text: responseDataChat.answer,
                    finishReason: 'stop',
                    usage: { promptTokens: 0, completionTokens: 0 },
                    rawCall: { rawPrompt: options.prompt, rawSettings: this.options },
                };
            }

          } else {

            const responseDataChat = responseData as FereAIChatResponse;
            if (this.settings.debug) {
                console.log('Received response chat:', responseDataChat,"\n");
            }
            result = {
                text: responseDataChat.answer,
                finishReason: 'stop',
                usage: { promptTokens: 0, completionTokens: 0 },
                rawCall: { rawPrompt: options.prompt, rawSettings: this.options },
            };

          }

          if (this.settings.debug) {
            console.log('Returning result:', result,"\n");
          }
          // Return the response
          resolve(result);

        } else {
          reject(new Error('WebSocket closed without receiving valid response'));
        }
      });
    });
  }

  public doStream = async (
        options: LanguageModelV1CallOptions
    ): Promise<{
        stream: ReadableStream<LanguageModelV1StreamPart>;
        rawCall: { rawPrompt: unknown; rawSettings: Record<string, unknown> };
        rawResponse?: { headers?: Record<string, string> };
        warnings?: LanguageModelV1CallWarning[];
    }> => {
        if (this.settings.debug) {
            console.log('stream options:', options);
        }

        if (['regular', 'object-json'].indexOf(options.mode.type) < 0) {
        throw new UnsupportedFunctionalityError({
            functionality: `${options.mode.type} mode`,
        });
        }

        const stream = new ReadableStream();

        return {
        stream,
        rawCall: { rawPrompt: options.prompt, rawSettings: this.options },
        };
    };

}

// Main FereAI Provider implementation
export interface FereAIProvider extends ProviderV1 {
  (modelId: FereAIModelId, settings?: FereAIChatSettings): LanguageModelV1;

  chat(modelId: FereAIModelId, settings?: FereAIChatSettings): LanguageModelV1;

  languageModel(
    modelId: FereAIModelId,
    settings?: FereAIChatSettings
  ): LanguageModelV1;
  
}

export function createFereAI(
  options: FereAIProviderSettings = {}
): FereAIProvider {
  const baseURL = withoutTrailingSlash(options.baseURL) ?? 'api.fereai.xyz';

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    ...options.headers,
  });

  const createChatModel = (
    modelId: FereAIModelId,
    settings: FereAIChatSettings = { debug: options.debug ?? false }
  ) =>
    new FereAIChatLanguageModel(modelId, settings, {
      baseURL,
      headers: getHeaders,
      provider: 'fereai',
    });

  const provider = function (
    modelId: FereAIModelId,
    settings?: FereAIChatSettings
  ) {
    if (new.target) {
      throw new Error(
        'The FereAI model function cannot be called with the new keyword.'
      );
    }

    return createChatModel(modelId, settings);
  };

  provider.chat = createChatModel;
  provider.languageModel = createChatModel;
  provider.textEmbeddingModel = () => {
    throw new UnsupportedFunctionalityError({
      functionality: 'textEmbeddingModel',
    });
  };

  return provider as FereAIProvider;
}

// Create default instance
export const fereai = createFereAI();
