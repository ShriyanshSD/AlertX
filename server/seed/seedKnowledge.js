import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import KnowledgeDocument from '../models/KnowledgeDocument.js';
import { KNOWLEDGE_DOCUMENTS } from '../data/knowledgeBase.js';

export async function seedKnowledgeBase() {
  await Promise.all(KNOWLEDGE_DOCUMENTS.map((document) => KnowledgeDocument.findOneAndUpdate(
    { slug: document.slug },
    { $set: { ...document, lastReviewedAt: new Date('2026-10-01T00:00:00.000Z'), isActive: true } },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  )));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  connectDatabase()
    .then(seedKnowledgeBase)
    .then(() => console.log('ResQ emergency knowledge base seeded.'))
    .catch((error) => {
      console.error('ResQ knowledge base seeding failed.', error);
      process.exitCode = 1;
    })
    .finally(disconnectDatabase);
}
