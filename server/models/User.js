import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  role: { type: String, enum: ['user', 'driver', 'operator', 'admin'], default: 'user', required: true },
}, { timestamps: true, versionKey: false });

userSchema.set('toJSON', {
  transform(_document, result) {
    delete result.passwordHash;
    return result;
  },
});

export default mongoose.model('User', userSchema);
