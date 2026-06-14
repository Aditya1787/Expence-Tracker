import mongoose from 'mongoose';

const importLogSchema = new mongoose.Schema(
  {
    rowNumber: {
      type: Number,
      required: true,
    },
    issueType: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    actionTaken: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['WARNING', 'ERROR', 'SUCCESS'],
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const ImportLog = mongoose.model('ImportLog', importLogSchema);

export default ImportLog;
