import { calculateBalances } from '../services/balance.service.js';
import Group from '../models/Group.model.js';

// @desc    Get group balances and simplified settlements
// @route   GET /api/balances/group/:groupId
// @access  Private
export const getGroupBalances = async (req, res, next) => {
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
      throw new Error('Not authorized to access group balances');
    }

    const balanceData = await calculateBalances(groupId);

    res.json({
      success: true,
      ...balanceData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user balances across all groups
// @route   GET /api/balances/user/:userId
// @access  Private
export const getUserBalances = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (userId !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Not authorized to view another user\'s balances');
    }

    // Find all groups user belongs to
    const groups = await Group.find({ 'members.user': userId }).select('_id name');
    
    let totalOwed = 0;
    let totalReceivable = 0;
    const groupSummaries = [];

    for (const group of groups) {
      const { balances } = await calculateBalances(group._id);
      const userBalanceRecord = balances.find(b => b.user._id.toString() === userId);
      
      if (userBalanceRecord) {
        const bal = userBalanceRecord.balance;
        if (bal < 0) {
          totalOwed += Math.abs(bal);
        } else if (bal > 0) {
          totalReceivable += bal;
        }

        groupSummaries.push({
          groupId: group._id,
          groupName: group.name,
          balance: bal,
        });
      }
    }

    res.json({
      success: true,
      totalOwed,
      totalReceivable,
      netBalance: totalReceivable - totalOwed,
      groups: groupSummaries,
    });
  } catch (error) {
    next(error);
  }
};
