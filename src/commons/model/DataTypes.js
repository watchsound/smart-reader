// OpenAI Models - Updated 2025
export const ChatGPTModel = Object.freeze({
  // Default models (faster, cheaper)
  GPT4_1_MINI: 'gpt-4.1-mini',
  GPT4_1_NANO: 'gpt-4.1-nano',
  GPT4O_MINI: 'gpt-4o-mini',
  // Advanced models (more capable)
  GPT4_1: 'gpt-4.1',
  GPT4O: 'gpt-4o',
  GPT5_MINI: 'gpt-5-mini',
  GPT5: 'gpt-5',
  O4_MINI: 'o4-mini',
});

// Google Gemini Models - Updated 2025
export const GeminiModel = Object.freeze({
  // Default models (faster, cheaper)
  GEMINI_2_FLASH: 'gemini-2.0-flash',
  GEMINI_2_5_FLASH: 'gemini-2.5-flash',
  GEMINI_2_5_FLASH_LITE: 'gemini-2.5-flash-lite-preview-06-17',
  // Advanced models (more capable)
  GEMINI_2_5_PRO: 'gemini-2.5-pro',
  GEMINI_3_FLASH: 'gemini-3-flash',
  GEMINI_3_PRO: 'gemini-3-pro',
});

// Anthropic Claude Models - Updated 2025
export const ClaudeModel = Object.freeze({
  // Default models (faster, cheaper)
  CLAUDE_HAIKU_4_5: 'claude-haiku-4-5',
  CLAUDE_SONNET_4: 'claude-sonnet-4-20250514',
  // Advanced models (more capable)
  CLAUDE_SONNET_4_5: 'claude-sonnet-4-5',
  CLAUDE_OPUS_4_5: 'claude-opus-4-5-20251101',
  CLAUDE_OPUS_4_6: 'claude-opus-4-6',
});

// Baidu ERNIE Models - Updated 2025
export const BaiduModel = Object.freeze({
  // Default models (faster, cheaper)
  ERNIE_4_5_TURBO: 'ernie-4.5-turbo',
  ERNIE_4_5_FLASH: 'ernie-4.5-flash',
  // Advanced models (more capable)
  ERNIE_4_5: 'ernie-4.5',
  ERNIE_5: 'ernie-5.0',
  ERNIE_X1: 'ernie-x1',
});

// Moonshot Kimi Models - Updated 2025
export const KimiModel = Object.freeze({
  // Default models (faster, cheaper)
  KIMI_K2_LITE: 'moonshot-v1-8k',
  KIMI_K2: 'kimi-k2-instruct',
  // Advanced models (more capable)
  KIMI_K2_5: 'kimi-k2.5',
  KIMI_K2_5_THINKING: 'kimi-k2.5-thinking',
});

// Ollama Models (Local) - Updated 2025
export const OllamaModel = Object.freeze({
  // Default models (smaller, faster)
  LLAMA_3_2_3B: 'llama3.2:3b',
  QWEN_2_5_7B: 'qwen2.5:7b',
  MISTRAL_7B: 'mistral:7b',
  // Advanced models (larger, more capable)
  LLAMA_3_3_70B: 'llama3.3:70b',
  QWEN_2_5_72B: 'qwen2.5:72b',
  DEEPSEEK_R1: 'deepseek-r1:32b',
});

// ByteDance Doubao Models - Updated 2026
export const DoubaoModel = Object.freeze({
  // Default models (faster, cheaper)
  DOUBAO_1_5_LITE_32K: 'doubao-1-5-lite-32k',
  DOUBAO_PRO_32K: 'doubao-pro-32k',
  DOUBAO_SEED_1_6_FLASH: 'doubao-seed-1-6-flash-250615',
  // Advanced models (more capable)
  DOUBAO_1_5_PRO_256K: 'doubao-1-5-pro-256k',
  DOUBAO_SEED_1_6: 'doubao-seed-1-6-250615',
  DOUBAO_SEED_1_8: 'doubao-seed-1-8-251215',
  DOUBAO_SEED_1_6_THINKING: 'doubao-seed-1-6-thinking-250615',
});

// Alibaba Qwen Models - Updated 2026
export const QwenModel = Object.freeze({
  // Default models (faster, cheaper)
  QWEN_TURBO: 'qwen-turbo',
  QWEN_FLASH: 'qwen-flash',
  QWEN3_5_FLASH: 'qwen3.5-flash',
  // Advanced models (more capable)
  QWEN_PLUS: 'qwen-plus',
  QWEN3_5_PLUS: 'qwen3.5-plus',
  QWEN_MAX: 'qwen-max',
  QWEN3_MAX: 'qwen3-max',
  QWQ_PLUS: 'qwq-plus', // Reasoning model
});

// DeepSeek Models - Added 2026 (low-cost, open-source-aligned, OpenAI-compatible API)
export const DeepSeekModel = Object.freeze({
  // Default model: V3 chat — strong text quality, ~5% of Claude cost
  DEEPSEEK_CHAT: 'deepseek-chat',
  // Reasoning model: R1 — extended-thinking-style reasoning
  DEEPSEEK_REASONER: 'deepseek-reasoner',
});

export const AIProvider = Object.freeze({
  ChatGPT: 'chatGPT',
  Gemini: 'gemini',
  Claude: 'claude',
  Baidu: 'baidu',
  Kimi: 'kimi',
  Ollama: 'ollama',
  Doubao: 'doubao',
  Qwen: 'qwen',
  DeepSeek: 'deepseek',
});

export const LanguageModel = Object.freeze({
  English: 'English',
  Chinese: 'Chinese',
  Japanese: 'Japanese',
});

export const LeitnerSpeed = Object.freeze({
  Slow: 4,
  Normal: 2,
  Fast: 1,
});



export const StudyMode = Object.freeze({
  General: 'general',
  Language: 'language',
  Math: 'math',
  Program: 'program',
});

export const StudyModeList = [
  StudyMode.General,
  StudyMode.Language,
  StudyMode.Math,
  StudyMode.Program,
];

export const knowledgeLevel = Object.freeze({
  EntryLevel: 'entrylevel',
  Middle: 'middle',
  Advanced: 'advanced',
});

export const ReaderLevel = Object.freeze({
  Elementary: 'elementary',
  Middle: 'middle',
  College: 'college',
});

export const ReaderLevelList = [
  ReaderLevel.Elementary,
  ReaderLevel.Middle,
  ReaderLevel.College,
];


export const QuizType = Object.freeze({
  ScoredQuiz: 'scored_quiz',
  InstantResultQuiz: 'instant_result_quiz',
});

export const QuestionType = Object.freeze({
  Radiogroup: 'radiogroup',
  Boolean: 'boolean',
  Checkbox: 'checkbox',
});
