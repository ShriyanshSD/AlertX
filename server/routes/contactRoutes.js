import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { createContact, deleteContact, listContacts, updateContact } from '../controllers/contactController.js';
import { contactSchemas } from '../utils/validationSchemas.js';

const router = Router();
router.use(authenticate);
router.get('/', listContacts);
router.post('/', validate({ body: contactSchemas.create }), createContact);
router.patch('/:contactId', validate({ params: contactSchemas.id, body: contactSchemas.update }), updateContact);
router.delete('/:contactId', validate({ params: contactSchemas.id }), deleteContact);

export default router;
