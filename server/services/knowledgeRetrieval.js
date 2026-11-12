import KnowledgeDocument from '../models/KnowledgeDocument.js';

const stopWords = new Set([
  'a', 'an', 'and', 'are', 'can', 'do', 'for', 'how', 'i', 'if', 'in', 'is',
  'it', 'me', 'my', 'of', 'on', 'or', 'should', 'the', 'to', 'what', 'when',
  'where', 'with', 'you', 'your',
]);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function queryTerms(query) {
  return [...new Set(
    (query.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
      .filter((term) => term.length > 2 && !stopWords.has(term)),
  )].slice(0, 12);
}

function scoreDocument(document, terms) {
  const title = document.title.toLocaleLowerCase();
  const content = document.content.toLocaleLowerCase();
  const keywords = document.keywords.map((keyword) => keyword.toLocaleLowerCase());
  const points = terms.reduce((total, term) => {
    const titlePoints = title.includes(term) ? 3 : 0;
    const keywordPoints = keywords.some((keyword) => keyword.includes(term)) ? 2 : 0;
    const contentPoints = content.includes(term) ? 0.5 : 0;
    return total + Math.max(titlePoints, keywordPoints, contentPoints);
  }, 0);
  return Number(Math.min(1, points / Math.max(1, terms.length * 3)).toFixed(2));
}

export async function retrieveKnowledge(query, limit = 4) {
  const terms = queryTerms(query);
  if (!terms.length) return [];

  const expression = terms.map((term) => new RegExp(escapeRegex(term), 'i'));
  const candidates = await KnowledgeDocument.find({
    isActive: true,
    $or: expression.flatMap((regex) => [
      { title: regex },
      { content: regex },
      { keywords: regex },
    ]),
  }).limit(50).lean();

  return candidates
    .map((document) => ({ ...document, relevance: scoreDocument(document, terms) }))
    .filter((document) => document.relevance >= 0.1)
    .sort((first, second) => second.relevance - first.relevance)
    .slice(0, limit);
}
