import mongoose from 'mongoose';

const knowledgeDocumentSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  category: {
    type: String,
    required: true,
    enum: ['first_aid', 'fire_safety', 'road_safety', 'personal_safety', 'platform'],
    index: true,
  },
  content: { type: String, required: true, trim: true, maxlength: 5000 },
  keywords: { type: [String], default: [] },
  sourceTitle: { type: String, required: true, trim: true, maxlength: 160 },
  sourceUrl: { type: String, trim: true, maxlength: 500, default: '' },
  lastReviewedAt: { type: Date, required: true },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true, versionKey: false });

export default mongoose.model('KnowledgeDocument', knowledgeDocumentSchema);
