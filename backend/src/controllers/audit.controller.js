import AuditLog from '../models/AuditLog.model.js';

// @desc    Get audit logs
// @route   GET /api/audit
// @access  Private
export const getAuditLogs = async (req, res, next) => {
  try {
    const logs = await AuditLog.find()
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(100); // Limit to last 100 for dashboard performance

    res.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    next(error);
  }
};
