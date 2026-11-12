import mongoose from 'mongoose';

const citationSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 160 },
  sourceTitle: { type: String, required: true, maxlength: 160 },
  sourceUrl: { type: String, maxlength: 500, default: '' },
  category: { type: String, required: true, maxlength: 40 },
}, { _id: false });

const emergencySchema = new mongoose.Schema({
  detected: { type: Boolean, default: false },
  type: { type: String, default: null },
  offerSos: { type: Boolean, default: false },
  askLocation: { type: Boolean, default: false },
}, { _id: false });

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true, maxlength: 5000 },
  citations: { type: [citationSchema], default: [] },
  emergency: { type: emergencySchema, default: undefined },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const aiConversationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  messages: { type: [messageSchema], default: [] },
}, { timestamps: true, versionKey: false });

export default mongoose.model('AIConversation', aiConversationSchema);
