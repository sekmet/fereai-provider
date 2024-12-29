import { describe, it, expect, vi } from 'vitest';
import WebSocket from 'ws';
import { createFereAI, FereAIChatLanguageModel } from './fereai-provider'; // Adjust the path as necessary

vi.mock('ws');

const mockedWebSocket = WebSocket as unknown as vi.Mock;

const mockResponseChat = {
  answer: 'Test Answer',
  chat_id: 'test_chat_id',
  representation: [],
  agent_api_name: 'ProAgent',
  query_summary: 'Test Query',
  agent_credits: 10,
  credits_available: 100,
};

const mockResponseMarketChat = {
    answer: 'Test Answer',
    chat_id: 'test_chat_id',
    representation: [],
    agent_api_name: 'MarketAnalyzerAgent',
    query_summary: 'Test Query',
    agent_credits: 10,
    credits_available: 100,
  };

const mockResponseSummary = {
  chat_id: 'test_chat_id',
  summary: 'Test Summary',
  agent_version: '1.0.0',
  agent_api_name: 'MarketAnalyzerAgent',
  query_summary: 'Test Query',
  is_summary: true,
  agent_credits: 10,
  credits_available: 100,
};

describe('[ProAgent] FereAIChatLanguageModel', () => {
  const modelId = 'ProAgent';
  const settings = { stream: true, debug: false };
  const options = {
    baseURL: 'api.fereai.xyz',
    headers: () => ({ 'Content-Type': 'application/json' }),
    provider: 'fereai',
  };
  const languageModel = new FereAIChatLanguageModel(modelId, settings, options);

  it('should generate WebSocket URL correctly', () => {
    process.env.FEREAI_API_KEY = 'test-api-key';
    process.env.FEREAI_USER_ID = 'test-user-id';

    const wsUrl = languageModel['getWebSocketUrl']('Test prompt');
    expect(wsUrl).toBe(
      `wss://${options.baseURL}/chat/v2/ws/test-user-id?X-FRIDAY-KEY=test-api-key`
    );
  });

  it('should throw an error for missing API configuration', () => {
    process.env.FEREAI_API_KEY = '';
    process.env.FEREAI_USER_ID = '';

    expect(() => languageModel['getWebSocketUrl']('Test prompt')).toThrow(
      'Missing required API configuration'
    );
  });

  it('should create a valid payload', () => {
    const payload = languageModel['createPayload']('Hello FereAI');
    expect(payload).toEqual({
      agent: modelId,
      stream: true,
      user_time: expect.any(String),
      x_hours: 1,
      parent: 0,
      message: 'Hello FereAI',
    });
  });

  it('should handle valid WebSocket chat response', async () => {
    process.env.FEREAI_API_KEY = 'test-api-key';
    process.env.FEREAI_USER_ID = 'test-user-id';

    mockedWebSocket.mockImplementation(() => ({
      on: vi.fn((event, callback) => {
        if (event === 'message') {
          callback(JSON.stringify(mockResponseChat));
        }
        if (event === 'close') {
          callback();
        }
      }),
      send: vi.fn(),
      close: vi.fn(),
    }));

    const options = { 
        prompt: [
            {
              "role": "user",
              "content": [
                {
                  "type": "text",
                  "text": "Test prompt"
                }
              ]
            }
        ] 
    };

    const result = await languageModel.doGenerate(options as any);
    expect(result.text).toBe(mockResponseChat.answer);
  });

  it('should handle WebSocket error', async () => {
    process.env.FEREAI_API_KEY = 'test-api-key';
    process.env.FEREAI_USER_ID = 'test-user-id';

    mockedWebSocket.mockImplementation(() => ({
      on: vi.fn((event, callback) => {
        if (event === 'error') {
          callback(new Error('WebSocket Error'));
        }
      }),
      send: vi.fn(),
      close: vi.fn(),
    }));

    const options = { 
        prompt: [
            {
              "role": "user",
              "content": [
                {
                  "type": "text",
                  "text": "Test prompt"
                }
              ]
            }
        ] 
    };

    await expect(languageModel.doGenerate(options as any)).rejects.toThrow(
      'WebSocket Error'
    );
  });
});

describe('[MarketAnalyzerAgent] FereAIChatLanguageModel', () => {
  const modelId = 'MarketAnalyzerAgent';
  const settings = { stream: true, debug: false };
  const options = {
    baseURL: 'api.fereai.xyz',
    headers: () => ({ 'Content-Type': 'application/json' }),
    provider: 'fereai',
  };
  const languageModel = new FereAIChatLanguageModel(modelId, settings, options);

  it('should generate WebSocket chat URL correctly', () => {
    process.env.FEREAI_API_KEY = 'test-api-key';
    process.env.FEREAI_USER_ID = 'test-user-id';

    const wsUrl = languageModel['getWebSocketUrl']('Test prompt');
    expect(wsUrl).toBe(
      `wss://${options.baseURL}/chat/v1/ws/test-user-id?X-FRIDAY-KEY=test-api-key`
    );
  });

  it('should throw an error for missing API configuration', () => {
    process.env.FEREAI_API_KEY = '';
    process.env.FEREAI_USER_ID = '';

    expect(() => languageModel['getWebSocketUrl']('Test prompt')).toThrow(
      'Missing required API configuration'
    );
  });

  it('should create a valid payload', () => {
    const payload = languageModel['createPayload']('Hello FereAI MarketAnalyzer');
    expect(payload).toEqual({
      agent: modelId,
      stream: true,
      user_time: expect.any(String),
      x_hours: 1,
      parent: 0,
      message: 'Hello FereAI MarketAnalyzer',
    });
  });

  it('should handle valid WebSocket chat response', async () => {
    process.env.FEREAI_API_KEY = 'test-api-key';
    process.env.FEREAI_USER_ID = 'test-user-id';

    mockedWebSocket.mockImplementation(() => ({
      on: vi.fn((event, callback) => {
        if (event === 'message') {
          callback(JSON.stringify(mockResponseMarketChat));
        }
        if (event === 'close') {
          callback();
        }
      }),
      send: vi.fn(),
      close: vi.fn(),
    }));

    const options = { 
        prompt: [
            {
              "role": "user",
              "content": [
                {
                  "type": "text",
                  "text": "Test prompt"
                }
              ]
            }
        ] 
    };

    const result = await languageModel.doGenerate(options as any);
    expect(result.text).toBe(mockResponseMarketChat.answer);
  });

  it('should generate WebSocket summary URL correctly', () => {
    process.env.FEREAI_API_KEY = 'test-api-key';
    process.env.FEREAI_USER_ID = 'test-user-id';

    const wsUrl = languageModel['getWebSocketUrl']('Test generate summary prompt');
    expect(wsUrl).toBe(
      `wss://${options.baseURL}/ws/generate_summary/test-user-id?X-FRIDAY-KEY=test-api-key`
    );
  });

  it('should handle valid WebSocket summary response', async () => {
    process.env.FEREAI_API_KEY = 'test-api-key';
    process.env.FEREAI_USER_ID = 'test-user-id';

    mockedWebSocket.mockImplementation(() => ({
      on: vi.fn((event, callback) => {
        if (event === 'message') {
          callback(JSON.stringify(mockResponseSummary));
        }
        if (event === 'close') {
          callback();
        }
      }),
      send: vi.fn(),
      close: vi.fn(),
    }));

    const options = { 
        prompt: [
            {
              "role": "user",
              "content": [
                {
                  "type": "text",
                  "text": "Generate summary test prompt"
                }
              ]
            }
        ] 
    };

    const result = await languageModel.doGenerate(options as any);
    expect(result.text).toBe(mockResponseSummary.summary);
  });

  it('should handle WebSocket error', async () => {
    process.env.FEREAI_API_KEY = 'test-api-key';
    process.env.FEREAI_USER_ID = 'test-user-id';

    mockedWebSocket.mockImplementation(() => ({
      on: vi.fn((event, callback) => {
        if (event === 'error') {
          callback(new Error('WebSocket Error'));
        }
      }),
      send: vi.fn(),
      close: vi.fn(),
    }));

    const options = { 
        prompt: [
            {
              "role": "user",
              "content": [
                {
                  "type": "text",
                  "text": "Test prompt"
                }
              ]
            }
        ] 
    };

    await expect(languageModel.doGenerate(options as any)).rejects.toThrow(
      'WebSocket Error'
    );
  });
});

describe('FereAI Provider', () => {
  const provider = createFereAI({
    baseURL: 'https://api.fereai.xyz',
    debug: true,
  });

  it('should create a ProAgent chat model', () => {
    const chatModel = provider.chat('ProAgent');
    expect(chatModel).toBeInstanceOf(FereAIChatLanguageModel);
  });

  it('should create a MarketAnalyzerAgent chat model', () => {
    const chatModel = provider.chat('MarketAnalyzerAgent');
    expect(chatModel).toBeInstanceOf(FereAIChatLanguageModel);
  });

  it('should throw for unsupported textEmbeddingModel', () => {
    expect(() => provider.textEmbeddingModel('')).toThrow(
      "'textEmbeddingModel' functionality not supported."
    );
  });
});
