import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'A valid record ID is required.');
const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);
const coordinates = z.object({ lat: latitude, lng: longitude });

export const authSchemas = {
  register: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    password: z.string().min(8).max(128),
    phone: z.string().trim().max(30).optional().default(''),
  }),
  login: z.object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(128),
  }),
  profile: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    phone: z.string().trim().max(30).optional(),
  }).refine((value) => Object.keys(value).length > 0, 'At least one field must be provided.'),
  password: z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8).max(128),
  }).refine((value) => value.currentPassword !== value.newPassword, {
    message: 'Choose a new password different from your current password.',
    path: ['newPassword'],
  }),
};

export const vehicleSchemas = {
  id: z.object({ vehicleId: z.string().trim().min(3).max(30) }),
  create: z.object({
    vehicleId: z.string().trim().min(3).max(30),
    type: z.enum(['ambulance', 'fire_truck', 'police']),
    driverName: z.string().trim().max(100).optional().default(''),
    operatorId: objectId.optional(),
    location: coordinates,
  }),
  status: z.object({ status: z.enum(['available', 'en_route', 'responding', 'patrolling', 'offline']) }),
  location: z.object({
    location: coordinates,
    speed: z.number().min(0).max(250).optional().default(0),
  }),
  nearby: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radiusKm: z.coerce.number().min(0.1).max(200).optional().default(20),
    type: z.enum(['ambulance', 'fire_truck', 'police']).optional(),
  }),
};

export const sosSchemas = {
  create: z.object({
    emergencyType: z.enum(['medical', 'fire', 'accident', 'personal_safety', 'other']),
    description: z.string().trim().max(1000).optional().default(''),
    locationLabel: z.string().trim().max(120).optional().default(''),
    location: coordinates,
    reportedFor: z.enum(['self', 'other']).optional().default('self'),
    personName: z.string().trim().max(100).optional().default(''),
    personRelationship: z.string().trim().max(50).optional().default(''),
    alertContactIds: z.array(objectId).max(20).optional().default([]),
  }).superRefine((request, context) => {
    if (request.reportedFor === 'other' && request.personName.length < 2) {
      context.addIssue({
        code: 'custom',
        message: 'Enter the name of the person who needs help.',
        path: ['personName'],
      });
    }
  }),
  id: z.object({ sosId: z.string().trim().min(5).max(60) }),
  status: z.object({ status: z.enum(['assigned', 'responding', 'resolved']) }),
  assign: z.object({ vehicleId: z.string().trim().min(3).max(30) }),
};

export const contactSchemas = {
  create: z.object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(5).max(30),
    relationship: z.string().trim().min(2).max(50),
    notificationConsent: z.boolean().optional().default(false),
    location: coordinates.optional(),
  }),
  id: z.object({ contactId: objectId }),
  update: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    phone: z.string().trim().min(5).max(30).optional(),
    relationship: z.string().trim().min(2).max(50).optional(),
    notificationConsent: z.boolean().optional(),
    isActive: z.boolean().optional(),
    location: coordinates.optional(),
  }).refine((value) => Object.keys(value).length > 0, 'At least one field must be provided.'),
};

export const adminUserSchemas = {
  id: z.object({
    userId: z.string().regex(/^[\da-f]{24}$/i, 'User ID is invalid.'),
  }),
  create: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    phone: z.string().trim().max(30).optional(),
    password: z.string().min(16).max(128),
    role: z.enum(['user', 'driver', 'operator', 'admin']),
  }).strict(),
  update: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()).optional(),
    phone: z.string().trim().max(30).optional(),
    role: z.enum(['user', 'driver', 'operator', 'admin']).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, {
    message: 'At least one account field must be provided.',
  }),
};

export const vehicleUpdateSchema = z.object({
  type: z.enum(['ambulance', 'fire_truck', 'police']).optional(),
  driverName: z.string().trim().max(100).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one fleet service field must be provided.',
});

export const adminSchemas = {
  users: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
  analytics: z.object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    type: z.enum(['medical', 'fire', 'accident', 'personal_safety', 'other']).optional(),
    priority: z.enum(['critical', 'high', 'medium']).optional(),
    status: z.enum(['pending', 'assigned', 'responding', 'resolved']).optional(),
  }).refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'The start date must not be after the end date.',
  }),
  aiChat: z.object({
    message: z.string().trim().min(1).max(1200),
    saveHistory: z.boolean().optional().default(false),
  }),
  nearbyResources: z.object({
    lat: latitude,
    lng: longitude,
    radiusKm: z.number().min(1).max(25).optional().default(10),
  }),
};
