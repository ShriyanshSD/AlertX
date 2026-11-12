import mongoose from 'mongoose';

const aiActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  category: {
    type: String,
    enum: ['first_aid', 'fire_safety', 'road_safety', 'personal_safety', 'platform', 'general'],
    default: 'general',
  },
  emergencyRelated: { type: Boolean, default: false },
  provider: { type: String, enum: ['gemini', 'knowledge_base', 'greeting'], required: true },
  createdAt: { type: Date, default: Date.now, index: true },
}, { versionKey: false });

export default mongoose.model('AIActivity', aiActivitySchema);
