import AuditLog from '../models/AuditLog.model.js';

/**
 * Creates an audit log entry.
 * @param {Object} params - Audit parameters
 * @param {string} params.entityType - 'GROUP' | 'EXPENSE' | 'SETTLEMENT' | 'USER'
 * @param {string} params.entityId - ID of target entity
 * @param {string} params.action - 'CREATE' | 'UPDATE' | 'DELETE' | 'MEMBER_JOIN' | 'MEMBER_LEAVE' | 'IMPORT_DECISION'
 * @param {Object} [params.oldValue] - Previous state
 * @param {Object} [params.newValue] - New state
 * @param {string} params.performedBy - User ID who triggered the action
 */
export const createAuditLog = async ({
  entityType,
  entityId,
  action,
  oldValue = null,
  newValue = null,
  performedBy,
}) => {
  try {
    const log = new AuditLog({
      entityType,
      entityId,
      action,
      oldValue,
      newValue,
      performedBy,
    });
    await log.save();
    return log;
  } catch (error) {
    console.error(`Audit Logging Error: ${error.message}`);
    // We do not crash the request if logging fails, but we print it
  }
};
