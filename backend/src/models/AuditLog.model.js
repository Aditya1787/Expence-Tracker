import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      required: true, // e.g. 'GROUP', 'EXPENSE', 'SETTLEMENT', 'IMPORT', 'USER'
    },
    entityId: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true, // e.g. 'CREATE', 'UPDATE', 'DELETE', 'MEMBER_JOIN', 'MEMBER_LEAVE', 'IMPORT_DECISION'
    },
    oldValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ performedBy: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
