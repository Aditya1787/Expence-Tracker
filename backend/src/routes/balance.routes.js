import express from 'express';
import { getGroupBalances, getUserBalances } from '../controllers/balance.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect); // All balance routes are protected

router.get('/group/:groupId', getGroupBalances);
router.get('/user/:userId', getUserBalances);

export default router;
