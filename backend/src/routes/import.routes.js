import express from 'express';
import { body, validationResult } from 'express-validator';
import { upload, importCSV, finalizeCSVImport, getImportReport } from '../controllers/import.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

router.use(protect); // All import routes are protected

// Multer handles the file field named 'file'
router.post('/', upload.single('file'), importCSV);

router.post(
  '/finalize',
  [
    body('groupId').notEmpty().withMessage('groupId is required').isMongoId().withMessage('Invalid group ID format'),
    body('resolvedRows').isArray({ min: 1 }).withMessage('resolvedRows must be a non-empty array'),
    body('tempFilePath').notEmpty().withMessage('tempFilePath is required'),
    validate
  ],
  finalizeCSVImport
);

router.get('/report/:id', getImportReport);

export default router;
