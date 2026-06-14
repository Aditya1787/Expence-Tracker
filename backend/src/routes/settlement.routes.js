import express from 'express';
import { body, validationResult } from 'express-validator';
import { getSettlements, createSettlement } from '../controllers/settlement.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

router.use(protect); // All settlement routes are protected

router.route('/')
  .get(getSettlements)
  .post(
    [
      body('groupId').notEmpty().withMessage('groupId is required').isMongoId().withMessage('Invalid group ID format'),
      body('payerId').notEmpty().withMessage('Payer ID is required').isMongoId().withMessage('Invalid payer ID format'),
      body('receiverId').notEmpty().withMessage('Receiver ID is required').isMongoId().withMessage('Invalid receiver ID format'),
      body('amount').isNumeric().withMessage('Amount must be a number').custom(val => val > 0).withMessage('Amount must be greater than zero'),
      validate
    ],
    createSettlement
  );

export default router;
