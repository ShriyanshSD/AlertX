import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { config } from '../config/env.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { serializeUser } from '../utils/serializers.js';
import { readToken } from '../middleware/auth.js';

const cookieOptions = () => ({
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: 'lax',
  path: '/',
  maxAge: 12 * 60 * 60 * 1000,
});

function issueSession(user, response) {
  const token = jwt.sign({ sub: String(user._id), role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    issuer: 'resq-api',
    audience: 'resq-client',
  });
  response.cookie('resq_token', token, cookieOptions());
}

export const register = asyncHandler(async (request, response) => {
  const { name, email, password, phone } = request.body;
  const existing = await User.exists({ email: email.toLowerCase() });
  if (existing) throw new AppError(409, 'An account with this email already exists.');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, phone, role: 'user' });
  issueSession(user, response);
  response.status(201).json({ data: { user: serializeUser(user) } });
});

export const login = asyncHandler(async (request, response) => {
  const { email, password } = request.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, 'Email or password is incorrect.');
  }
  issueSession(user, response);
  response.json({ data: { user: serializeUser(user) } });
});

export const currentUser = asyncHandler(async (request, response) => {
  response.json({ data: { user: serializeUser(request.user) } });
});

export const currentSession = asyncHandler(async (request, response) => {
  const token = readToken(request);
  if (!token) return response.json({ data: { user: null } });

  let claims;
  try {
    claims = jwt.verify(token, config.jwtSecret, { issuer: 'resq-api', audience: 'resq-client' });
  } catch (error) {
    if (!(error instanceof jwt.JsonWebTokenError)) throw error;
    response.clearCookie('resq_token', cookieOptions());
    return response.json({ data: { user: null } });
  }

  const user = await User.findById(claims.sub);
  if (!user) {
    response.clearCookie('resq_token', cookieOptions());
    return response.json({ data: { user: null } });
  }
  return response.json({ data: { user: serializeUser(user) } });
});

export const updateProfile = asyncHandler(async (request, response) => {
  Object.assign(request.user, request.body);
  await request.user.save();
  response.json({ data: { user: serializeUser(request.user) } });
});

export const changePassword = asyncHandler(async (request, response) => {
  const { currentPassword, newPassword } = request.body;
  const user = await User.findById(request.user._id).select('+passwordHash');
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError(400, 'Current password is incorrect.');
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  response.json({ data: { passwordUpdated: true } });
});

export function logout(_request, response) {
  response.clearCookie('resq_token', {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
  });
  response.json({ data: { loggedOut: true } });
}
