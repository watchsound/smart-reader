export interface Chat {
  id: number;
  description: string;
  totalTokens: number;
  createdAt: Date;
  pinned: boolean;
  autoDelete: boolean;
}

export interface Message {
  id: number;
  chatId: string;
  role: 'system' | 'assistant' | 'user';
  content: string;
  createdAt: Date;
}

export interface Prompt {
  id: number;
  title: string;
  content: string;
  createdAt: Date;
}

export interface Settings {
  id: 'general';
  openAiApiKey?: string;
  openAiModel?: string;
  openAiApiType?: 'openai' | 'custom';
  openAiApiAuth?: 'none' | 'bearer-token' | 'api-key';
  openAiApiBase?: string;
  openAiApiVersion?: string;
}
