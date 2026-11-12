import Contact from '../models/Contact.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { toPoint } from '../utils/geo.js';
import { serializeContact } from '../utils/serializers.js';

export const listContacts = asyncHandler(async (request, response) => {
  const contacts = await Contact.find({ userId: request.user._id, isActive: true }).sort({ name: 1 });
  response.json({ data: { contacts: contacts.map(serializeContact) } });
});

export const createContact = asyncHandler(async (request, response) => {
  const { location, ...details } = request.body;
  const contact = await Contact.create({
    ...details,
    userId: request.user._id,
    ...(location ? { location: toPoint(location) } : {}),
  });
  response.status(201).json({ data: { contact: serializeContact(contact) } });
});

export const updateContact = asyncHandler(async (request, response) => {
  const { location, ...details } = request.body;
  const contact = await Contact.findOne({ _id: request.params.contactId, userId: request.user._id });
  if (!contact) throw new AppError(404, 'Contact not found.');
  Object.assign(contact, details);
  if (location) contact.location = toPoint(location);
  await contact.save();
  response.json({ data: { contact: serializeContact(contact) } });
});

export const deleteContact = asyncHandler(async (request, response) => {
  const contact = await Contact.findOneAndDelete({ _id: request.params.contactId, userId: request.user._id });
  if (!contact) throw new AppError(404, 'Contact not found.');
  response.json({ data: { deleted: String(contact._id) } });
});
