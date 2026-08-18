import dotenv from 'dotenv';

dotenv.config();

export interface AICompletionOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  responseFormat?: 'json' | 'text';
}

export interface AIProvider {
  name: string;
  generateCompletion(options: AICompletionOptions): Promise<string>;
}

export class OpenAIProvider implements AIProvider {
  name = 'OpenAI';
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
  }

  async generateCompletion(options: AICompletionOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API Key is missing');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.userPrompt }
        ],
        temperature: options.temperature ?? 0.2,
        response_format: options.responseFormat === 'json' ? { type: 'json_object' } : undefined
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }
}

export class AnthropicProvider implements AIProvider {
  name = 'Anthropic';
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
  }

  async generateCompletion(options: AICompletionOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Anthropic API Key is missing');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        system: options.systemPrompt,
        messages: [{ role: 'user', content: options.userPrompt }],
        temperature: options.temperature ?? 0.2
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data.content[0]?.text || '';
  }
}

export class LocalLLMProvider implements AIProvider {
  name = 'LocalLLM';
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.LOCAL_LLM_URL || 'http://localhost:11434';
  }

  async generateCompletion(options: AICompletionOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3',
        prompt: `${options.systemPrompt}\n\n${options.userPrompt}`,
        stream: false,
        format: options.responseFormat === 'json' ? 'json' : undefined
      })
    });

    if (!response.ok) {
      throw new Error(`Local LLM error: ${response.status}`);
    }

    const data = await response.json();
    return data.response || '';
  }
}

export class AIServiceManager {
  private activeProvider: AIProvider;

  constructor() {
    const providerName = (process.env.AI_PROVIDER || 'openai').toLowerCase();
    if (providerName === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      this.activeProvider = new AnthropicProvider();
    } else if (providerName === 'local') {
      this.activeProvider = new LocalLLMProvider();
    } else if (process.env.OPENAI_API_KEY) {
      this.activeProvider = new OpenAIProvider();
    } else {
      // Fallback instance
      this.activeProvider = new OpenAIProvider('dummy-key-for-fallback');
    }
  }

  getProviderName(): string {
    return this.activeProvider.name;
  }

  async completeJSON<T>(systemPrompt: string, userPrompt: string, fallbackGenerator: () => T): Promise<T> {
    try {
      const raw = await this.activeProvider.generateCompletion({
        systemPrompt,
        userPrompt,
        temperature: 0.2,
        responseFormat: 'json'
      });
      const parsed = JSON.parse(raw);
      return parsed as T;
    } catch (err) {
      console.warn(`AI Provider execution fallback triggered: ${(err as Error).message}`);
      return fallbackGenerator();
    }
  }
}

export const aiManager = new AIServiceManager();
