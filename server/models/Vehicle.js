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

const vehicleSchema = new mongoose.Schema({
  vehicleId: { type: String, required: true, unique: true, trim: true, uppercase: true },
  type: { type: String, enum: ['ambulance', 'fire_truck', 'police'], required: true },
  driverName: { type: String, trim: true, maxlength: 100, default: '' },
  operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  status: { type: String, enum: ['available', 'en_route', 'responding', 'patrolling', 'offline'], default: 'available', index: true },
  currentLocation: { type: pointSchema, required: true, index: '2dsphere' },
  speed: { type: Number, min: 0, max: 250, default: 0 },
  heading: { type: Number, min: 0, max: 359, default: 0 },
  assignedSOS: { type: mongoose.Schema.Types.ObjectId, ref: 'SOS', default: null, index: true },
  isDemo: { type: Boolean, default: true, index: true },
  lastUpdated: { type: Date, default: Date.now },
}, { timestamps: true, versionKey: false });

export default mongoose.model('Vehicle', vehicleSchema);
