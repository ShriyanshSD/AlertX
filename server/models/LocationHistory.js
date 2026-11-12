import mongoose from 'mongoose';

const locationHistorySchema = new mongoose.Schema({
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: (coordinates) => coordinates.length === 2,
    },
  },
  speed: { type: Number, min: 0, max: 250, default: 0 },
  timestamp: { type: Date, default: Date.now },
  isDemo: { type: Boolean, default: true, index: true },
}, { versionKey: false });

locationHistorySchema.index({ location: '2dsphere' });
locationHistorySchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export default mongoose.model('LocationHistory', locationHistorySchema);
