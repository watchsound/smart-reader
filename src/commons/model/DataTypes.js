export const ChatGPTModel = Object.freeze({
  GPT4: 'gpt-4',
  GPT4o: 'gpt-4o',
  GPT3_5: 'gpt-3.5-turbo',
});

export const GeminiModel = Object.freeze({
  GEMINI1_5_flash: 'gemini-1.5-flash',
  GEMINI1_5_pro: 'gemini-1.5-pro',
});

export const ClaudeModel = Object.freeze({
  CLAUDE_3_OPUS: 'claude-3-opus-20240229',
  CLAUDE_3_SONNET: 'claude-3-sonnet-20240229',
  CLAUDE_3_HAIKU: 'claude-3-haiku-20240307',
});

export const AIProvider = Object.freeze({
  ChatGPT: 'chatGPT',
  Gemini: 'gemini',
  Claude: 'claude',
  Baidu: 'baidu',
  Kimi: 'kimi',
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
