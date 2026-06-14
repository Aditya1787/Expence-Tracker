import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  shareAmount: {
    type: Number,
    required: true,
  },
  percentage: {
    type: Number,
  },
  shares: {
    type: Number,
  },
});

const expenseSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide an expense title'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Please provide an expense amount'],
    },
    currency: {
      type: String,
      enum: ['INR', 'USD'],
      default: 'INR',
    },
    exchangeRate: {
      type: Number,
      default: 1.0,
    },
    amountInINR: {
      type: Number,
      required: true,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expenseDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    splitType: {
      type: String,
      enum: ['equal', 'exact', 'percentage', 'shares'],
      required: true,
    },
    participants: [participantSchema],
  },
  {
    timestamps: true,
  }
);

// Indexes for query performance
expenseSchema.index({ group: 1, expenseDate: -1 });
expenseSchema.index({ paidBy: 1 });

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;
