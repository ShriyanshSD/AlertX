import mongoose from 'mongoose';

const emergencyAlertSchema = new mongoose.Schema({
  sosId: { type: mongoose.Schema.Types.ObjectId, ref: 'SOS', required: true, index: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
  recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  channel: { type: String, enum: ['in_app'], default: 'in_app' },
  status: { type: String, enum: ['created', 'consent_required'], required: true },
  isDemo: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

export default mongoose.model('EmergencyAlert', emergencyAlertSchema);
