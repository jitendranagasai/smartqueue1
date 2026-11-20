import { Router } from 'express';
import {
  getOrganizations,
  getOrganizationById,
  getOrganizationServices
} from '../controllers/organization.controller.js';

export const organizationRouter = Router();

organizationRouter.get('/', getOrganizations);
organizationRouter.get('/search', getOrganizations);
organizationRouter.get('/:id', getOrganizationById);
organizationRouter.get('/:id/services', getOrganizationServices);
