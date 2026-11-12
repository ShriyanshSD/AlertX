import mongoose from 'mongoose';

const pointSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], required: true, default: 'Point' },
  coordinates: {
    type: [Number],
    required: true,
    validate: {
      validator: (coordinates) => coordinates.length === 2
        && coordinates[0] >= -180 && coordinates[0] <= 180
        && coordinates[1] >= -90 && coordinates[1] <= 90,
      message: 'Location must contain valid longitude and latitude coordinates.',
    },
  },
}, { _id: false });

const contactSchema = new mongoose.Schema({
  contactCode: { type: String, trim: true, unique: true, sparse: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  relationship: { type: String, required: true, trim: true, maxlength: 50 },
  location: { type: pointSchema, default: undefined },
  notificationConsent: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false });

export default mongoose.model('Contact', contactSchema);
