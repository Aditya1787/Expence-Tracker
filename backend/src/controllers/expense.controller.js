import Expense from '../models/Expense.model.js';
import Group from '../models/Group.model.js';
import User from '../models/User.model.js';
import { calculateSplits } from '../utils/splitCalculator.js';
import { createAuditLog } from '../services/audit.service.js';

// Helper to check member timeframe limits
const validateMemberTimeline = (group, userId, date) => {
  const member = group.members.find(
    (m) => m.user.toString() === userId.toString()
  );

  if (!member) {
    throw new Error(`User is not a member of the group`);
  }

  const joinedAt = new Date(member.joinedAt);
  const leftAt = member.leftAt ? new Date(member.leftAt) : null;
  const expenseDate = new Date(date);

  const expenseDateOnly = new Date(expenseDate.getFullYear(), expenseDate.getMonth(), expenseDate.getDate());
  const joinedOnly = new Date(joinedAt.getFullYear(), joinedAt.getMonth(), joinedAt.getDate());
  const leftOnly = leftAt ? new Date(leftAt.getFullYear(), leftAt.getMonth(), leftAt.getDate()) : null;

  // Check if expense date is before member joined
  if (expenseDateOnly < joinedOnly) {
    throw new Error(
      `Participant was not in the group yet on this date (Joined: ${joinedAt.toLocaleDateString()})`
    );
  }

  // Check if expense date is after member left
  if (leftOnly && expenseDateOnly > leftOnly) {
    throw new Error(
      `Participant had already left the group on this date (Left: ${leftAt.toLocaleDateString()})`
    );
  }
};

// @desc    Get all expenses with search, filtering, and pagination
// @route   GET /api/expenses
// @access  Private
export const getExpenses = async (req, res, next) => {
  try {
    const {
      search,
      splitType,
      paidBy,
      groupId,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};

    // Filter by groups the user is part of
    if (groupId) {
      query.group = groupId;
    } else {
      const userGroups = await Group.find({ 'members.user': req.user._id }).select('_id');
      const groupIds = userGroups.map(g => g._id);
      query.group = { $in: groupIds };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (splitType) {
      query.splitType = splitType;
    }

    if (paidBy) {
      query.paidBy = paidBy;
    }

    const skipIndex = (page - 1) * limit;

    const total = await Expense.countDocuments(query);
    const expenses = await Expense.find(query)
      .populate('paidBy', 'name email avatar')
      .populate('participants.user', 'name email avatar')
      .populate('group', 'name')
      .sort({ expenseDate: -1 })
      .skip(skipIndex)
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: expenses.length,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
      expenses,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all expenses for a specific group
// @route   GET /api/expenses/group/:groupId
// @access  Private
export const getExpensesByGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    // Verify user membership in group
    const group = await Group.findById(groupId);
    if (!group) {
      res.status(404);
      throw new Error('Group not found');
    }

    const isMember = group.members.some(m => m.user.toString() === req.user._id.toString());
    if (!isMember) {
      res.status(403);
      throw new Error('Not authorized to access this group\'s expenses');
    }

    const expenses = await Expense.find({ group: groupId })
      .populate('paidBy', 'name email avatar')
      .populate('participants.user', 'name email avatar')
      .sort({ expenseDate: -1 });

    res.json({
      success: true,
      count: expenses.length,
      expenses,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new expense
// @route   POST /api/expenses
// @access  Private
export const createExpense = async (req, res, next) => {
  try {
    const {
      groupId,
      title,
      description,
      amount,
      currency = 'INR',
      exchangeRate = 1.0,
      paidBy,
      expenseDate = new Date(),
      splitType,
      participants = [],
    } = req.body;

    const group = await Group.findById(groupId);
    if (!group) {
      res.status(404);
      throw new Error('Group not found');
    }

    // Check dates and timeline for payer
    validateMemberTimeline(group, paidBy, expenseDate);

    // Check dates and timeline for all participants
    participants.forEach((p) => {
      validateMemberTimeline(group, p.user, expenseDate);
    });

    // Run Split Calculator
    const calculatedParticipants = calculateSplits(
      splitType,
      amount,
      participants
    );

    // Determine exchange rates and INR amount
    const cleanExchangeRate = currency === 'USD' ? parseFloat(exchangeRate) || parseFloat(process.env.EXCHANGE_RATE_FALLBACK) || 83.0 : 1.0;
    const amountInINR = amount * cleanExchangeRate;

    const expense = new Expense({
      group: groupId,
      title,
      description,
      amount,
      currency,
      exchangeRate: cleanExchangeRate,
      amountInINR,
      paidBy,
      expenseDate,
      splitType,
      participants: calculatedParticipants,
    });

    await expense.save();
    await expense.populate('paidBy', 'name email avatar');
    await expense.populate('participants.user', 'name email avatar');

    // Audit Log
    await createAuditLog({
      entityType: 'EXPENSE',
      entityId: expense._id.toString(),
      action: 'CREATE',
      newValue: expense.toJSON(),
      performedBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      expense,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update an expense
// @route   PUT /api/expenses/:id
// @access  Private
export const updateExpense = async (req, res, next) => {
  try {
    const {
      title,
      description,
      amount,
      currency,
      exchangeRate,
      paidBy,
      expenseDate,
      splitType,
      participants = [],
    } = req.body;

    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      res.status(404);
      throw new Error('Expense not found');
    }

    const group = await Group.findById(expense.group);
    
    // Validate timelines if paidBy or date changed
    const targetPaidBy = paidBy || expense.paidBy;
    const targetDate = expenseDate || expense.expenseDate;
    
    validateMemberTimeline(group, targetPaidBy, targetDate);

    const oldValue = expense.toJSON();

    if (title) expense.title = title;
    if (description !== undefined) expense.description = description;
    if (expenseDate) expense.expenseDate = expenseDate;

    // If amount, splitType, or participants change, recalculate splits
    if (amount || splitType || participants.length > 0 || currency || paidBy) {
      const targetAmount = amount !== undefined ? amount : expense.amount;
      const targetSplitType = splitType || expense.splitType;
      const targetParticipants = participants.length > 0 ? participants : expense.participants;
      const targetCurrency = currency || expense.currency;

      // Validate timelines for all target participants
      targetParticipants.forEach((p) => {
        validateMemberTimeline(group, p.user, targetDate);
      });

      const calculatedParticipants = calculateSplits(
        targetSplitType,
        targetAmount,
        targetParticipants
      );

      const targetExchangeRate = exchangeRate || expense.exchangeRate;
      const cleanExchangeRate = targetCurrency === 'USD' ? parseFloat(targetExchangeRate) || parseFloat(process.env.EXCHANGE_RATE_FALLBACK) || 83.0 : 1.0;

      expense.amount = targetAmount;
      expense.splitType = targetSplitType;
      expense.participants = calculatedParticipants;
      expense.currency = targetCurrency;
      expense.exchangeRate = cleanExchangeRate;
      expense.amountInINR = targetAmount * cleanExchangeRate;
      expense.paidBy = targetPaidBy;
    }

    await expense.save();
    await expense.populate('paidBy', 'name email avatar');
    await expense.populate('participants.user', 'name email avatar');

    // Audit Log
    await createAuditLog({
      entityType: 'EXPENSE',
      entityId: expense._id.toString(),
      action: 'UPDATE',
      oldValue,
      newValue: expense.toJSON(),
      performedBy: req.user._id,
    });

    res.json({
      success: true,
      expense,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete an expense
// @route   DELETE /api/expenses/:id
// @access  Private
export const deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      res.status(404);
      throw new Error('Expense not found');
    }

    const oldValue = expense.toJSON();
    await Expense.deleteOne({ _id: req.params.id });

    // Audit Log
    await createAuditLog({
      entityType: 'EXPENSE',
      entityId: req.params.id,
      action: 'DELETE',
      oldValue,
      performedBy: req.user._id,
    });

    res.json({
      success: true,
      message: 'Expense deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
