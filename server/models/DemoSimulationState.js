import mongoose from 'mongoose';

const demoSimulationStateSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  running: { type: Boolean, default: false },
  lastTickAt: { type: Date, default: () => new Date(0) },
  leaseOwner: { type: String },
  leaseExpiresAt: { type: Date, default: () => new Date(0) },
}, { timestamps: true, versionKey: false });

export default mongoose.model('DemoSimulationState', demoSimulationStateSchema);
