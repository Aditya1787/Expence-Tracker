import express from 'express';
import { getAuditLogs } from '../controllers/audit.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect); // All audit routes are protected

router.get('/', getAuditLogs);

export default router;
