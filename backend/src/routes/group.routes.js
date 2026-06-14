import express from 'express';
import { body, validationResult } from 'express-validator';
import {
  getGroups,
  createGroup,
  getGroupById,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember
} from '../controllers/group.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

router.use(protect); // All group routes are protected

router.route('/')
  .get(getGroups)
  .post(
    [
      body('name').notEmpty().withMessage('Group name is required').trim(),
      validate
    ],
    createGroup
  );

router.route('/:id')
  .get(getGroupById)
  .put(
    [
      body('name').optional().notEmpty().withMessage('Group name cannot be empty').trim(),
      validate
    ],
    updateGroup
  )
  .delete(deleteGroup);

router.post(
  '/:id/members',
  [
    body('email').isEmail().withMessage('Provide a valid email address').normalizeEmail(),
    validate
  ],
  addMember
);

router.delete('/:id/members/:memberId', removeMember);

export default router;
