import express from 'express';
import { body, validationResult } from 'express-validator';
import {
  getExpenses,
  getExpensesByGroup,
  createExpense,
  updateExpense,
  deleteExpense
} from '../controllers/expense.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

router.use(protect); // All expense routes are protected

router.route('/')
  .get(getExpenses)
  .post(
    [
      body('groupId').notEmpty().withMessage('groupId is required').isMongoId().withMessage('Invalid group ID format'),
      body('title').notEmpty().withMessage('Expense title is required').trim(),
      body('amount').isNumeric().withMessage('Expense amount must be a number'),
      body('paidBy').notEmpty().withMessage('Payer (paidBy) is required').isMongoId().withMessage('Invalid payer ID format'),
      body('splitType').isIn(['equal', 'exact', 'percentage', 'shares']).withMessage('Invalid split type'),
      body('participants').isArray({ min: 1 }).withMessage('At least one participant is required'),
      validate
    ],
    createExpense
  );

router.route('/:id')
  .put(
    [
      body('groupId').optional().isMongoId().withMessage('Invalid group ID format'),
      body('title').optional().notEmpty().withMessage('Expense title cannot be empty').trim(),
      body('amount').optional().isNumeric().withMessage('Expense amount must be a number'),
      body('paidBy').optional().isMongoId().withMessage('Invalid payer ID format'),
      body('splitType').optional().isIn(['equal', 'exact', 'percentage', 'shares']).withMessage('Invalid split type'),
      body('participants').optional().isArray({ min: 1 }).withMessage('Participants list cannot be empty'),
      validate
    ],
    updateExpense
  )
  .delete(deleteExpense);

router.get('/group/:groupId', getExpensesByGroup);

export default router;
