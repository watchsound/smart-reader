/**
 * EmbeddingService.js
 *
 * Builds an embedding function for the active AI provider, replacing
 * Chroma's built-in OpenAIEmbeddingFunction / GoogleGenerativeAiEmbeddingFunction.
 *
 * Returns `(text) => Promise<number[] | null>`. A null return means the active
 * provider doesn't have a configured embedding endpoint; callers degrade to
 * text-only search rather than failing.
 *
 * Supported today: OpenAI (text-embedding-3-small), Gemini (text-embedding-004),
 * Ollama (nomic-embed-text). Other providers get null until we add a path.
 */

import axios from 'axios';
import { AIProvider } from '../../commons/model/DataTypes';

const OPENAI_EMBED_MODEL = 'text-embedding-3-small';
const GEMINI_EMBED_MODEL = 'text-embedding-004';
const OLLAMA_EMBED_MODEL = 'nomic-embed-text';

async function openAIEmbed(apiKey, text) {
  const res = await axios.post(
    'https://api.openai.com/v1/embeddings',
    { input: text, model: OPENAI_EMBED_MODEL },
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  return res.data?.data?.[0]?.embedding ?? null;
}

async function geminiEmbed(apiKey, text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:embedContent?key=${apiKey}`;
  const res = await axios.post(url, {
    content: { parts: [{ text }] },
  });
  return res.data?.embedding?.values ?? null;
}

async function ollamaEmbed(baseUrl, text) {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/embeddings`;
  const res = await axios.post(url, {
    model: OLLAMA_EMBED_MODEL,
    prompt: text,
  });
  return res.data?.embedding ?? null;
}

/**
 * Build an embedding function for the given provider + user.
 * Returns null if no embedding path is configured for this provider.
 *
 * @param {Object} store electron-store
 * @param {number} userId
 * @param {string} providerName from AIProvider
 * @returns {((text: string) => Promise<number[] | null>) | null}
 */
export function buildEmbeddingFunction(store, userId, providerName) {
  if (!store || userId == null || userId < 0) return null;

  if (providerName === AIProvider.ChatGPT) {
    const key = store.get(`openai_key_${userId}`);
    if (!key) return null;
    return (text) =>
      openAIEmbed(key, text).catch((e) => {
        console.warn('EmbeddingService(OpenAI):', e.message || e);
        return null;
      });
  }

  if (providerName === AIProvider.Gemini) {
    const key = store.get(`gemini_key_${userId}`);
    if (!key) return null;
    return (text) =>
      geminiEmbed(key, text).catch((e) => {
        console.warn('EmbeddingService(Gemini):', e.message || e);
        return null;
      });
  }

  if (providerName === AIProvider.Ollama) {
    const baseUrl =
      store.get(`ollama_url_${userId}`) ||
      store.get('ollama_url') ||
      'http://127.0.0.1:11434';
    return (text) =>
      ollamaEmbed(baseUrl, text).catch((e) => {
        console.warn('EmbeddingService(Ollama):', e.message || e);
        return null;
      });
  }

  return null;
}

/**
 * Cosine similarity between two vectors. Returns 0 if either is empty or
 * lengths differ. Used by the in-memory temp RAG ranker.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
