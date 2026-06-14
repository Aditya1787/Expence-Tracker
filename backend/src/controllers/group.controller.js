import Group from '../models/Group.model.js';
import User from '../models/User.model.js';
import { createAuditLog } from '../services/audit.service.js';

// @desc    Get all groups for logged-in user
// @route   GET /api/groups
// @access  Private
export const getGroups = async (req, res, next) => {
  try {
    const userId = req.user._id;
    // Find groups where members array contains the user
    const groups = await Group.find({
      'members.user': userId,
    }).populate('createdBy', 'name email').populate('members.user', 'name email avatar');

    res.json({
      success: true,
      count: groups.length,
      groups,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new group
// @route   POST /api/groups
// @access  Private
export const createGroup = async (req, res, next) => {
  try {
    const { name, description, memberEmails = [] } = req.body;
    const userId = req.user._id;

    // Build member list starting with the creator
    const members = [{
      user: userId,
      joinedAt: new Date(),
      status: 'ACTIVE'
    }];

    // Resolve other emails if any
    for (const email of memberEmails) {
      if (email.trim() && email.trim().toLowerCase() !== req.user.email.toLowerCase()) {
        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (user) {
          // Check if already in array
          const exists = members.find(m => m.user.toString() === user._id.toString());
          if (!exists) {
            members.push({
              user: user._id,
              joinedAt: new Date(),
              status: 'ACTIVE'
            });
          }
        }
      }
    }

    const group = new Group({
      name,
      description,
      createdBy: userId,
      members,
    });

    await group.save();

    // Populate members for response
    await group.populate('members.user', 'name email avatar');

    // Audit Log
    await createAuditLog({
      entityType: 'GROUP',
      entityId: group._id.toString(),
      action: 'CREATE',
      newValue: group.toJSON(),
      performedBy: userId,
    });

    res.status(201).json({
      success: true,
      group,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single group by ID
// @route   GET /api/groups/:id
// @access  Private
export const getGroupById = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('members.user', 'name email avatar');

    if (!group) {
      res.status(404);
      throw new Error('Group not found');
    }

    // Check if user is member of the group
    const isMember = group.members.some(m => m.user._id.toString() === req.user._id.toString());
    if (!isMember) {
      res.status(403);
      throw new Error('Not authorized to access this group');
    }

    res.json({
      success: true,
      group,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update group details
// @route   PUT /api/groups/:id
// @access  Private
export const updateGroup = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) {
      res.status(404);
      throw new Error('Group not found');
    }

    // Only creator or active members can update group
    const isMember = group.members.some(m => m.user.toString() === req.user._id.toString() && m.status === 'ACTIVE');
    if (!isMember) {
      res.status(403);
      throw new Error('Not authorized to modify this group');
    }

    const oldValue = group.toJSON();

    if (name) group.name = name;
    if (description !== undefined) group.description = description;

    await group.save();
    await group.populate('members.user', 'name email avatar');

    // Audit Log
    await createAuditLog({
      entityType: 'GROUP',
      entityId: group._id.toString(),
      action: 'UPDATE',
      oldValue,
      newValue: group.toJSON(),
      performedBy: req.user._id,
    });

    res.json({
      success: true,
      group,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete group
// @route   DELETE /api/groups/:id
// @access  Private
export const deleteGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      res.status(404);
      throw new Error('Group not found');
    }

    // Only creator can delete group
    if (group.createdBy.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Only the group creator can delete this group');
    }

    const oldValue = group.toJSON();
    await Group.deleteOne({ _id: req.params.id });

    // Audit Log
    await createAuditLog({
      entityType: 'GROUP',
      entityId: req.params.id,
      action: 'DELETE',
      oldValue,
      performedBy: req.user._id,
    });

    res.json({
      success: true,
      message: 'Group deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add member to group
// @route   POST /api/groups/:id/members
// @access  Private
export const addMember = async (req, res, next) => {
  try {
    const { email } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) {
      res.status(404);
      throw new Error('Group not found');
    }

    // Check permissions
    const isMember = group.members.some(m => m.user.toString() === req.user._id.toString() && m.status === 'ACTIVE');
    if (!isMember) {
      res.status(403);
      throw new Error('Not authorized to add members to this group');
    }

    const targetUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (!targetUser) {
      res.status(404);
      throw new Error(`User with email "${email}" not found`);
    }

    // Check if user is already a member
    const existingMemberIndex = group.members.findIndex(
      (m) => m.user.toString() === targetUser._id.toString()
    );

    const oldValue = group.toJSON();

    if (existingMemberIndex !== -1) {
      const member = group.members[existingMemberIndex];
      if (member.status === 'ACTIVE') {
        res.status(400);
        throw new Error('User is already an active member of this group');
      } else {
        // Reactivate member
        member.status = 'ACTIVE';
        member.joinedAt = new Date(); // Reset join time to current so they do not participate in previous expenses
        member.leftAt = undefined;
      }
    } else {
      // Add new member
      group.members.push({
        user: targetUser._id,
        joinedAt: new Date(),
        status: 'ACTIVE',
      });
    }

    await group.save();
    await group.populate('members.user', 'name email avatar');

    // Audit Log
    await createAuditLog({
      entityType: 'GROUP',
      entityId: group._id.toString(),
      action: 'MEMBER_JOIN',
      oldValue,
      newValue: { targetUser: targetUser._id, email: targetUser.email },
      performedBy: req.user._id,
    });

    res.json({
      success: true,
      group,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove member from group (marks as LEFT)
// @route   DELETE /api/groups/:id/members/:memberId
// @access  Private
export const removeMember = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    const memberId = req.params.memberId;

    if (!group) {
      res.status(404);
      throw new Error('Group not found');
    }

    // Only creator or active member can remove someone (a member can also remove themselves)
    const isSelf = memberId === req.user._id.toString();
    const isCreator = group.createdBy.toString() === req.user._id.toString();
    const isGroupMember = group.members.some(m => m.user.toString() === req.user._id.toString() && m.status === 'ACTIVE');

    if (!isGroupMember && !isSelf && !isCreator) {
      res.status(403);
      throw new Error('Not authorized to modify members in this group');
    }

    const memberIndex = group.members.findIndex(
      (m) => m.user.toString() === memberId && m.status === 'ACTIVE'
    );

    if (memberIndex === -1) {
      res.status(404);
      throw new Error('Active member not found in this group');
    }

    const oldValue = group.toJSON();

    // Set member status to LEFT and add leftAt timestamp
    group.members[memberIndex].status = 'LEFT';
    group.members[memberIndex].leftAt = new Date();

    await group.save();
    await group.populate('members.user', 'name email avatar');

    // Audit Log
    await createAuditLog({
      entityType: 'GROUP',
      entityId: group._id.toString(),
      action: 'MEMBER_LEAVE',
      oldValue,
      newValue: { leftUser: memberId },
      performedBy: req.user._id,
    });

    res.json({
      success: true,
      group,
    });
  } catch (error) {
    next(error);
  }
};
