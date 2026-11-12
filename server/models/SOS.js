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

const alertContactSchema = new mongoose.Schema({
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
  status: { type: String, enum: ['in_app_created', 'consent_required'], required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const sosSchema = new mongoose.Schema({
  sosId: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  emergencyType: { type: String, enum: ['medical', 'fire', 'accident', 'personal_safety', 'other'], required: true },
  priority: { type: String, enum: ['critical', 'high', 'medium'], required: true },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  location: { type: pointSchema, required: true, index: '2dsphere' },
  locationLabel: { type: String, trim: true, maxlength: 120, default: '' },
  assignedVehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
  status: { type: String, enum: ['pending', 'assigned', 'responding', 'resolved'], default: 'pending', index: true },
  alertContacts: { type: [alertContactSchema], default: [] },
  createdAt: { type: Date, default: Date.now, index: true },
  resolvedAt: { type: Date, default: null },
  isDemo: { type: Boolean, default: true, index: true },
}, { versionKey: false });

export default mongoose.model('SOS', sosSchema);
