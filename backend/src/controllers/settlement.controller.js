import Settlement from '../models/Settlement.model.js';
import Group from '../models/Group.model.js';
import { createAuditLog } from '../services/audit.service.js';

// @desc    Get all settlements for group or user
// @route   GET /api/settlements
// @access  Private
export const getSettlements = async (req, res, next) => {
  try {
    const { groupId } = req.query;
    const query = {};

    if (groupId) {
      query.group = groupId;
    } else {
      // Find settlements for groups the user belongs to
      const userGroups = await Group.find({ 'members.user': req.user._id }).select('_id');
      const groupIds = userGroups.map(g => g._id);
      query.group = { $in: groupIds };
    }

    const settlements = await Settlement.find(query)
      .populate('payer', 'name email avatar')
      .populate('receiver', 'name email avatar')
      .populate('group', 'name')
      .sort({ date: -1 });

    res.json({
      success: true,
      count: settlements.length,
      settlements,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Record a settlement payment
// @route   POST /api/settlements
// @access  Private
export const createSettlement = async (req, res, next) => {
  try {
    const { groupId, payerId, receiverId, amount, date = new Date(), note } = req.body;

    // Verify group exists
    const group = await Group.findById(groupId);
    if (!group) {
      res.status(404);
      throw new Error('Group not found');
    }

    // Verify payer and receiver are members of the group
    const isPayerMember = group.members.some(m => m.user.toString() === payerId.toString());
    const isReceiverMember = group.members.some(m => m.user.toString() === receiverId.toString());

    if (!isPayerMember || !isReceiverMember) {
      res.status(400);
      throw new Error('Both payer and receiver must be members of the group');
    }

    const settlement = new Settlement({
      group: groupId,
      payer: payerId,
      receiver: receiverId,
      amount,
      date,
      note: note || 'Settled via cash/transfer',
    });

    await settlement.save();
    await settlement.populate('payer', 'name email avatar');
    await settlement.populate('receiver', 'name email avatar');

    // Audit Log
    await createAuditLog({
      entityType: 'SETTLEMENT',
      entityId: settlement._id.toString(),
      action: 'CREATE',
      newValue: settlement.toJSON(),
      performedBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      settlement,
    });
  } catch (error) {
    next(error);
  }
};
