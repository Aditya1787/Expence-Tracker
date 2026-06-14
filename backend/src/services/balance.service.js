import Expense from '../models/Expense.model.js';
import Settlement from '../models/Settlement.model.js';
import Group from '../models/Group.model.js';
import User from '../models/User.model.js';

/**
 * Priority Queue class to achieve O(n log n) complexity for debt simplification.
 */
class PriorityQueue {
  constructor(compare) {
    this.data = [];
    this.compare = compare; // (a, b) => positive if a has higher priority than b
  }

  push(item) {
    this.data.push(item);
    this.up(this.data.length - 1);
  }

  pop() {
    if (this.data.length === 0) return null;
    const top = this.data[0];
    const bottom = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = bottom;
      this.down(0);
    }
    return top;
  }

  size() {
    return this.data.length;
  }

  up(i) {
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.compare(this.data[i], this.data[p]) <= 0) break;
      this.swap(i, p);
      i = p;
    }
  }

  down(i) {
    const len = this.data.length;
    while (i * 2 + 1 < len) {
      let left = i * 2 + 1;
      let right = i * 2 + 2;
      let best = i;

      if (this.compare(this.data[left], this.data[best]) > 0) {
        best = left;
      }
      if (right < len && this.compare(this.data[right], this.data[best]) > 0) {
        best = right;
      }
      if (best === i) break;
      this.swap(i, best);
      i = best;
    }
  }

  swap(i, j) {
    const temp = this.data[i];
    this.data[i] = this.data[j];
    this.data[j] = temp;
  }
}

/**
 * Calculates net balances and generates simplified debt settlements.
 */
export const calculateBalances = async (groupId) => {
  // 1. Fetch group members
  const group = await Group.findById(groupId).populate('members.user', 'name email avatar');
  if (!group) {
    throw new Error('Group not found');
  }

  const membersMap = {};
  const memberList = group.members.map((m) => {
    const u = m.user;
    membersMap[u._id.toString()] = {
      _id: u._id.toString(),
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      status: m.status,
    };
    return u._id.toString();
  });

  // Initialize balances map in INR
  const balances = {};
  memberList.forEach((userId) => {
    balances[userId] = 0;
  });

  // 2. Fetch expenses and add to balances
  const expenses = await Expense.find({ group: groupId });
  expenses.forEach((expense) => {
    const payerId = expense.paidBy.toString();
    const exchangeRate = expense.exchangeRate || 1.0;

    // Add to payer's paid amount
    if (balances[payerId] !== undefined) {
      balances[payerId] += expense.amount * exchangeRate;
    }

    // Subtract from participants' owed amount
    expense.participants.forEach((p) => {
      const pId = p.user.toString();
      if (balances[pId] !== undefined) {
        balances[pId] -= p.shareAmount * exchangeRate;
      }
    });
  });

  // 3. Fetch settlements and adjust balances
  const settlements = await Settlement.find({ group: groupId });
  settlements.forEach((settlement) => {
    const payerId = settlement.payer.toString();
    const receiverId = settlement.receiver.toString();

    // Payer sent money -> reduce their debt (add to balance)
    if (balances[payerId] !== undefined) {
      balances[payerId] += settlement.amount;
    }
    // Receiver got money -> reduce their credit (subtract from balance)
    if (balances[receiverId] !== undefined) {
      balances[receiverId] -= settlement.amount;
    }
  });

  // 4. Build detailed individual balances
  const detailedBalances = Object.keys(balances).map((userId) => {
    const member = membersMap[userId];
    return {
      user: member,
      balance: Math.round(balances[userId] * 100) / 100, // round to 2 decimals
    };
  });

  // 5. Debt Simplification Algorithm - O(n log n)
  // Creditors queue (Max-Heap based on credit size)
  const creditorsQueue = new PriorityQueue((a, b) => a.balance - b.balance);
  // Debtors queue (Max-Heap based on debt size, stored as positive absolute value)
  const debtorsQueue = new PriorityQueue((a, b) => a.debt - b.debt);

  detailedBalances.forEach((item) => {
    if (item.balance > 0.01) {
      creditorsQueue.push({ userId: item.user._id, name: item.user.name, balance: item.balance });
    } else if (item.balance < -0.01) {
      debtorsQueue.push({ userId: item.user._id, name: item.user.name, debt: -item.balance });
    }
  });

  const simplifiedPayments = [];

  while (debtorsQueue.size() > 0 && creditorsQueue.size() > 0) {
    const debtor = debtorsQueue.pop();
    const creditor = creditorsQueue.pop();

    const settleAmount = Math.min(debtor.debt, creditor.balance);
    const roundedSettleAmount = Math.round(settleAmount * 100) / 100;

    if (roundedSettleAmount > 0) {
      simplifiedPayments.push({
        from: debtor.userId,
        fromName: debtor.name,
        to: creditor.userId,
        toName: creditor.name,
        amount: roundedSettleAmount,
      });
    }

    const remainingDebt = debtor.debt - settleAmount;
    const remainingCredit = creditor.balance - settleAmount;

    if (remainingDebt > 0.01) {
      debtorsQueue.push({ userId: debtor.userId, name: debtor.name, debt: remainingDebt });
    }
    if (remainingCredit > 0.01) {
      creditorsQueue.push({ userId: creditor.userId, name: creditor.name, balance: remainingCredit });
    }
  }

  // Calculate total group expenses (sum of all amounts in INR)
  const totalGroupExpenses = expenses.reduce((sum, e) => sum + e.amountInINR, 0);

  return {
    balances: detailedBalances,
    simplifiedSettlements: simplifiedPayments,
    totalExpenses: totalGroupExpenses,
  };
};
