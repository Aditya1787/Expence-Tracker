import fs from 'fs';
import csvParser from 'csv-parser';
import User from '../models/User.model.js';
import Group from '../models/Group.model.js';
import Expense from '../models/Expense.model.js';
import Settlement from '../models/Settlement.model.js';
import ImportLog from '../models/ImportLog.model.js';
import { createAuditLog } from './audit.service.js';

/**
 * Normalizes user names to match user database names
 */
const findUserByName = (name, allUsers) => {
  if (!name) return null;
  const cleanName = name.trim().toLowerCase();
  // Try exact match first
  let user = allUsers.find(u => u.name.trim().toLowerCase() === cleanName);
  if (user) return user;

  // Try matching first name or prefix
  user = allUsers.find(u => {
    const dbName = u.name.trim().toLowerCase();
    return dbName.startsWith(cleanName) || cleanName.startsWith(dbName);
  });
  return user;
};

/**
 * Parses dates in common formats (e.g., DD-MM-YYYY, YYYY-MM-DD)
 */
const parseCSVDate = (dateStr) => {
  if (!dateStr) return null;
  const str = dateStr.trim();
  
  // Match DD-MM-YYYY
  const dmYRegex = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
  let match = str.match(dmYRegex);
  if (match) {
    const [_, d, m, y] = match;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) return date;
  }

  // Match YYYY-MM-DD
  const YmdRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  match = str.match(YmdRegex);
  if (match) {
    const [_, y, m, d] = match;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) return date;
  }

  // Standard fallback JS Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
};

/**
 * Analyzes CSV file and returns the validation report without saving to the DB.
 */
export const analyzeCSV = async (filePath, groupId) => {
  const group = await Group.findById(groupId).populate('members.user');
  if (!group) throw new Error('Group not found');

  const allUsers = await User.find({});
  const existingExpenses = await Expense.find({ group: groupId });

  const rows = [];
  const report = {
    totalRows: 0,
    importedRowsCount: 0,
    warningsCount: 0,
    errorsCount: 0,
    rows: []
  };

  // Helper to parse CSV using a promise
  const parsePromise = new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => rows.push(data))
      .on('end', resolve)
      .on('error', reject);
  });

  await parsePromise;

  const seenRows = new Set(); // For duplicates within CSV

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i];
    const rowNumber = i + 2; // CSV headers are row 1, data starts at row 2
    report.totalRows++;

    const anomalies = [];
    let status = 'SUCCESS';

    // Extract headers: date, description, paid_by, amount, currency, split_type, split_with, split_details, notes
    const {
      date: rawDate,
      description: rawDesc,
      paid_by: rawPaidBy,
      amount: rawAmount,
      currency: rawCurrency,
      split_type: rawSplitType,
      split_with: rawSplitWith,
      split_details: rawSplitDetails,
      notes: rawNotes
    } = rawRow;

    // Check 20: Corrupted rows
    if (Object.keys(rawRow).length < 4) {
      status = 'ERROR';
      anomalies.push({
        issueType: 'CORRUPTED_ROW',
        description: 'Row is missing critical columns.',
        actionTaken: 'Skip row'
      });
      report.rows.push({ rowNumber, rawRow, status, anomalies });
      report.errorsCount++;
      continue;
    }

    // Check 14: Empty descriptions
    let description = rawDesc ? rawDesc.trim() : '';
    if (!description) {
      anomalies.push({
        issueType: 'EMPTY_DESCRIPTION',
        description: 'Description is empty.',
        actionTaken: `Assigning default: "Imported Expense - ${rawDate || 'No Date'}"`
      });
      description = `Imported Expense - ${rawDate || 'No Date'}`;
      if (status !== 'ERROR') status = 'WARNING';
    }

    // Check 4: Invalid date
    const expenseDate = parseCSVDate(rawDate);
    if (!expenseDate) {
      status = 'ERROR';
      anomalies.push({
        issueType: 'INVALID_DATE',
        description: `Date "${rawDate}" could not be parsed.`,
        actionTaken: 'Skip row'
      });
      report.rows.push({ rowNumber, rawRow, status, anomalies });
      report.errorsCount++;
      continue;
    }

    // Check 5: Invalid amount format
    let cleanAmountStr = rawAmount ? rawAmount.trim() : '';
    // Strip commas, quotes
    cleanAmountStr = cleanAmountStr.replace(/["',]/g, '');
    const amount = parseFloat(cleanAmountStr);
    
    if (isNaN(amount)) {
      status = 'ERROR';
      anomalies.push({
        issueType: 'INVALID_AMOUNT_FORMAT',
        description: `Amount "${rawAmount}" is invalid.`,
        actionTaken: 'Skip row'
      });
      report.rows.push({ rowNumber, rawRow, status, anomalies });
      report.errorsCount++;
      continue;
    }

    // Check 3: Negative amounts
    let isRefund = false;
    if (amount < 0) {
      isRefund = true;
      if (status !== 'ERROR') status = 'WARNING';
      anomalies.push({
        issueType: 'NEGATIVE_AMOUNT',
        description: `Amount is negative (${amount}).`,
        actionTaken: 'Treat as refund, ask for confirmation'
      });
    }

    // Check 18 / 9: Invalid/Missing Currency
    let currency = rawCurrency ? rawCurrency.trim().toUpperCase() : '';
    if (!currency) {
      currency = 'INR';
      if (status !== 'ERROR') status = 'WARNING';
      anomalies.push({
        issueType: 'MISSING_CURRENCY',
        description: 'Currency is empty. Defaulting to INR.',
        actionTaken: 'Set currency to INR'
      });
    } else if (currency !== 'INR' && currency !== 'USD') {
      status = 'ERROR';
      anomalies.push({
        issueType: 'INVALID_CURRENCY',
        description: `Currency "${currency}" is unsupported (only INR and USD allowed).`,
        actionTaken: 'Skip row'
      });
      report.rows.push({ rowNumber, rawRow, status, anomalies });
      report.errorsCount++;
      continue;
    }

    // Check 12: Missing payer
    if (!rawPaidBy || !rawPaidBy.trim()) {
      status = 'ERROR';
      anomalies.push({
        issueType: 'MISSING_PAYER',
        description: 'Payer field is empty.',
        actionTaken: 'Require manual mapping'
      });
      report.rows.push({ rowNumber, rawRow, status, anomalies });
      report.errorsCount++;
      continue;
    }

    // Check 7: Unknown payer user
    let paidByUser = findUserByName(rawPaidBy, allUsers);
    if (!paidByUser) {
      if (status !== 'ERROR') status = 'WARNING';
      anomalies.push({
        issueType: 'UNKNOWN_USER',
        description: `Payer "${rawPaidBy}" does not match any user in system.`,
        actionTaken: 'Create pending mapping (require manual input)'
      });
    }

    // Check 8: Settlement logged as expense
    const isSettlementIndicator = 
      (description.toLowerCase().includes('paid back') || 
       description.toLowerCase().includes('settle') || 
       description.toLowerCase().includes('repay') || 
       description.toLowerCase().includes('repayment')) && 
      !rawSplitType;

    let isSettlement = isSettlementIndicator;
    if (isSettlement && status !== 'ERROR') {
      status = 'WARNING';
      anomalies.push({
        issueType: 'SETTLEMENT_LOGGED_AS_EXPENSE',
        description: `Description "${description}" indicates a peer settlement, not an expense.`,
        actionTaken: 'Convert to settlement'
      });
    }

    // Check 19: Missing participants
    if (!isSettlement && (!rawSplitWith || !rawSplitWith.trim())) {
      status = 'ERROR';
      anomalies.push({
        issueType: 'MISSING_PARTICIPANTS',
        description: 'Participants field (split_with) is empty.',
        actionTaken: 'Skip row'
      });
      report.rows.push({ rowNumber, rawRow, status, anomalies });
      report.errorsCount++;
      continue;
    }

    // Check 13: Unsupported split type
    let splitType = rawSplitType ? rawSplitType.trim().toLowerCase() : '';
    if (splitType === 'unequal') {
      splitType = 'exact'; // Map 'unequal' split type to 'exact'
    }

    if (!isSettlement && !['equal', 'exact', 'percentage', 'shares'].includes(splitType)) {
      status = 'ERROR';
      anomalies.push({
        issueType: 'UNSUPPORTED_SPLIT_TYPE',
        description: `Split type "${rawSplitType}" is unsupported.`,
        actionTaken: 'Skip row'
      });
      report.rows.push({ rowNumber, rawRow, status, anomalies });
      report.errorsCount++;
      continue;
    }

    // Process participants
    let participantNames = [];
    if (rawSplitWith) {
      participantNames = rawSplitWith.split(';').map(n => n.trim()).filter(Boolean);
    }

    // Resolve participants to DB Users
    let unresolvedParticipantsCount = 0;
    const resolvedParticipants = [];
    const rawParticipantMappings = [];

    participantNames.forEach(pName => {
      const pUser = findUserByName(pName, allUsers);
      rawParticipantMappings.push({ rawName: pName, resolvedUser: pUser });
      if (!pUser) {
        unresolvedParticipantsCount++;
      } else {
        resolvedParticipants.push(pUser);
      }
    });

    if (unresolvedParticipantsCount > 0) {
      if (status !== 'ERROR') status = 'WARNING';
      anomalies.push({
        issueType: 'UNKNOWN_USER',
        description: `${unresolvedParticipantsCount} split participant(s) match no user in system.`,
        actionTaken: 'Create pending mapping (require manual input)'
      });
    }

    // Check 10 & 11: Expense before member joined or after member left
    // We check only resolved participants against the group membership timestamps
    const timeBoundedParticipants = [];
    
    rawParticipantMappings.forEach(({ rawName, resolvedUser }) => {
      if (resolvedUser) {
        const memberRec = group.members.find(m => m.user._id.toString() === resolvedUser._id.toString());
        if (memberRec) {
          const joined = new Date(memberRec.joinedAt);
          const left = memberRec.leftAt ? new Date(memberRec.leftAt) : null;

          // Normalize dates to local midnight date-only representation for comparison
          const expenseDateOnly = new Date(expenseDate.getFullYear(), expenseDate.getMonth(), expenseDate.getDate());
          const joinedOnly = new Date(joined.getFullYear(), joined.getMonth(), joined.getDate());
          const leftOnly = left ? new Date(left.getFullYear(), left.getMonth(), left.getDate()) : null;

          if (expenseDateOnly < joinedOnly) {
            if (status !== 'ERROR') status = 'WARNING';
            anomalies.push({
              issueType: 'EXPENSE_BEFORE_MEMBER_JOINED',
              description: `Participant "${resolvedUser.name}" had not joined group on ${expenseDate.toLocaleDateString()}`,
              actionTaken: 'Exclude member from split'
            });
          } else if (leftOnly && expenseDateOnly > leftOnly) {
            if (status !== 'ERROR') status = 'WARNING';
            anomalies.push({
              issueType: 'EXPENSE_AFTER_MEMBER_LEFT',
              description: `Participant "${resolvedUser.name}" had already left group on ${expenseDate.toLocaleDateString()}`,
              actionTaken: 'Exclude member from split'
            });
          } else {
            timeBoundedParticipants.push(resolvedUser);
          }
        } else {
          // System user but not in this group!
          if (status !== 'ERROR') status = 'WARNING';
          anomalies.push({
            issueType: 'UNKNOWN_USER',
            description: `User "${resolvedUser.name}" is not a member of this group.`,
            actionTaken: 'Exclude member from split'
          });
        }
      }
    });

    // Check duplicates: same date, paid_by, description, amount
    const duplicateKey = `${rawDate}_${rawPaidBy}_${description}_${amount}`;
    let isDuplicate = false;

    // Check duplicate within this CSV
    if (seenRows.has(duplicateKey)) {
      isDuplicate = true;
      if (status !== 'ERROR') status = 'WARNING';
      anomalies.push({
        issueType: 'DUPLICATE_EXPENSE',
        description: 'Identical transaction exists in this CSV file.',
        actionTaken: 'Flag for approval'
      });
    }
    seenRows.add(duplicateKey);

    // Check duplicate in database
    const dbDuplicate = existingExpenses.find(e => {
      const sameDate = new Date(e.expenseDate).toDateString() === expenseDate.toDateString();
      const samePaidBy = paidByUser && e.paidBy.toString() === paidByUser._id.toString();
      const sameDesc = e.title.trim().toLowerCase() === description.trim().toLowerCase();
      const sameAmount = Math.abs(e.amount - Math.abs(amount)) < 0.01; // absolute match
      return sameDate && samePaidBy && sameDesc && sameAmount;
    });

    if (dbDuplicate) {
      isDuplicate = true;
      if (status !== 'ERROR') status = 'WARNING';
      anomalies.push({
        issueType: 'DUPLICATE_EXPENSE',
        description: 'Identical transaction already exists in group database.',
        actionTaken: 'Flag for approval'
      });
    }

    // Check duplicate with different amount
    const dbDiffAmountDup = existingExpenses.find(e => {
      const sameDate = new Date(e.expenseDate).toDateString() === expenseDate.toDateString();
      const samePaidBy = paidByUser && e.paidBy.toString() === paidByUser._id.toString();
      const sameDesc = e.title.trim().toLowerCase() === description.trim().toLowerCase();
      const diffAmount = Math.abs(e.amount - Math.abs(amount)) >= 0.01;
      return sameDate && samePaidBy && sameDesc && diffAmount;
    });

    if (dbDiffAmountDup) {
      if (status !== 'ERROR') status = 'WARNING';
      anomalies.push({
        issueType: 'DUPLICATE_EXPENSE_DIFFERENT_AMOUNT',
        description: `Matching transaction found but with different amount: DB has ${dbDiffAmountDup.amount}, CSV has ${amount}.`,
        actionTaken: 'Flag conflict'
      });
    }

    // Split details parsing
    let splitDetails = {};
    if (rawSplitDetails) {
      // e.g. "Rohan 700; Priya 400; Meera 400" or "Aisha 30%; Rohan 30%; Priya 30%; Meera 20%"
      rawSplitDetails.split(';').forEach(detail => {
        const parts = detail.trim().split(/\s+/);
        if (parts.length >= 2) {
          const pValStr = parts.pop().replace(/%/g, '');
          const pName = parts.join(' ');
          splitDetails[pName.trim().toLowerCase()] = parseFloat(pValStr);
        }
      });
    }

    // Validations on splits
    if (!isSettlement) {
      if (splitType === 'percentage') {
        // Check 16: Invalid percentages
        let totalPercent = 0;
        Object.values(splitDetails).forEach(p => {
          totalPercent += p;
        });
        if (Object.keys(splitDetails).length > 0 && Math.abs(totalPercent - 100) > 0.01) {
          status = 'ERROR';
          anomalies.push({
            issueType: 'INVALID_PERCENTAGE',
            description: `Sum of percentages is ${totalPercent}%, must be exactly 100%.`,
            actionTaken: 'Reject row'
          });
          report.rows.push({ rowNumber, rawRow, status, anomalies });
          report.errorsCount++;
          continue;
        }
      } else if (splitType === 'exact') {
        // Check exact splits sum
        let totalExact = 0;
        Object.values(splitDetails).forEach(a => {
          totalExact += a;
        });
        const absAmount = Math.abs(amount);
        if (Object.keys(splitDetails).length > 0 && Math.abs(totalExact - absAmount) > 0.01) {
          status = 'ERROR';
          anomalies.push({
            issueType: 'INVALID_EXACT_SPLIT',
            description: `Sum of exact splits (${totalExact}) does not equal total amount (${absAmount}).`,
            actionTaken: 'Reject row'
          });
          report.rows.push({ rowNumber, rawRow, status, anomalies });
          report.errorsCount++;
          continue;
        }
      } else if (splitType === 'shares') {
        // Check 17: Invalid share counts
        let hasInvalidShares = false;
        Object.values(splitDetails).forEach(s => {
          if (s <= 0) hasInvalidShares = true;
        });
        if (hasInvalidShares) {
          status = 'ERROR';
          anomalies.push({
            issueType: 'INVALID_SHARES',
            description: 'Share count must be greater than zero.',
            actionTaken: 'Reject row'
          });
          report.rows.push({ rowNumber, rawRow, status, anomalies });
          report.errorsCount++;
          continue;
        }
      }
    }

    // Determine row safety
    // A row is safe to auto-import (SUCCESS status) if there are no errors AND no warnings.
    // If it has warnings, it is PENDING_CONFIRMATION in frontend, requiring approval.
    if (status === 'WARNING') report.warningsCount++;

    report.rows.push({
      rowNumber,
      rawRow,
      status, // SUCCESS, WARNING, ERROR
      anomalies,
      parsedData: {
        date: expenseDate,
        description,
        paidByRaw: rawPaidBy,
        paidByUserId: paidByUser ? paidByUser._id : null,
        amount: Math.abs(amount),
        isRefund,
        currency,
        splitType,
        isSettlement,
        participantsRaw: participantNames,
        participantsResolved: timeBoundedParticipants.map(u => u._id.toString()),
        splitDetails,
        notes: rawNotes || ''
      }
    });
  }

  // Save the ImportLogs of errors and warnings into DB for audit
  for (const item of report.rows) {
    if (item.anomalies.length > 0) {
      for (const anomaly of item.anomalies) {
        await ImportLog.create({
          rowNumber: item.rowNumber,
          issueType: anomaly.issueType,
          description: anomaly.description,
          actionTaken: anomaly.actionTaken,
          status: item.status
        });
      }
    }
  }

  return report;
};

/**
 * Finalizes CSV import by processing the validated data (with resolved manual mappings).
 * @param {string} groupId - ID of the group
 * @param {string} userId - ID of user executing import
 * @param {Array} resolvedRows - List of row data from the report with resolutions applied
 */
export const finalizeImport = async (groupId, userId, resolvedRows) => {
  const group = await Group.findById(groupId);
  if (!group) throw new Error('Group not found');

  const exchangeRateFallback = parseFloat(process.env.EXCHANGE_RATE_FALLBACK) || 83.0;
  const importedCount = { expenses: 0, settlements: 0 };
  const createdEntities = [];

  for (const row of resolvedRows) {
    const { parsedData, action } = row;
    
    // Skip if user chose to skip/reject this row or if it was marked as error
    if (action === 'SKIP' || row.status === 'ERROR') {
      continue;
    }

    const {
      date,
      description,
      paidByUserId,
      amount,
      isRefund,
      currency,
      splitType,
      isSettlement,
      participantsResolved,
      splitDetails,
      notes
    } = parsedData;

    // Use exchange rate
    const exchangeRate = currency === 'USD' ? exchangeRateFallback : 1.0;
    const amountInINR = amount * exchangeRate;

    if (isSettlement) {
      // Create settlement
      // In settlement, paidBy is payer, and splitWith (first element) is receiver
      const receiverId = participantsResolved && participantsResolved.length > 0 
        ? participantsResolved[0] 
        : null;

      if (!paidByUserId || !receiverId) {
        continue; // invalid resolution
      }

      const settlement = new Settlement({
        group: groupId,
        payer: paidByUserId,
        receiver: receiverId,
        amount, // Stored in INR since settlements are standard peer transactions
        date: date || new Date(),
        note: notes || 'Imported Settlement'
      });

      await settlement.save();
      importedCount.settlements++;

      // Log Audit
      await createAuditLog({
        entityType: 'SETTLEMENT',
        entityId: settlement._id.toString(),
        action: 'CREATE',
        newValue: settlement.toJSON(),
        performedBy: userId
      });

      createdEntities.push({ type: 'Settlement', id: settlement._id });

    } else {
      // Create Expense
      // Recalculate split participant shares
      let participants = [];
      const numParticipants = participantsResolved.length;

      if (numParticipants === 0) continue;

      const finalAmount = isRefund ? -amount : amount;
      const finalAmountInINR = isRefund ? -amountInINR : amountInINR;

      if (splitType === 'equal') {
        const shareAmount = finalAmount / numParticipants;
        participants = participantsResolved.map(pId => ({
          user: pId,
          shareAmount: Math.round(shareAmount * 100) / 100
        }));
      } else if (splitType === 'percentage') {
        // find percentage values by participant name matching User Name
        const users = await User.find({ _id: { $in: participantsResolved } });
        participants = users.map(user => {
          const cleanName = user.name.trim().toLowerCase();
          const pct = splitDetails[cleanName] || (100 / numParticipants);
          const shareAmount = (pct / 100) * finalAmount;
          return {
            user: user._id,
            percentage: pct,
            shareAmount: Math.round(shareAmount * 100) / 100
          };
        });
      } else if (splitType === 'exact') {
        const users = await User.find({ _id: { $in: participantsResolved } });
        participants = users.map(user => {
          const cleanName = user.name.trim().toLowerCase();
          const shareAmount = splitDetails[cleanName] || (finalAmount / numParticipants);
          return {
            user: user._id,
            shareAmount: Math.round(shareAmount * 100) / 100
          };
        });
      } else if (splitType === 'shares') {
        const users = await User.find({ _id: { $in: participantsResolved } });
        let totalShares = 0;
        
        const userShares = users.map(user => {
          const cleanName = user.name.trim().toLowerCase();
          const shares = splitDetails[cleanName] || 1;
          totalShares += shares;
          return { user: user._id, shares };
        });

        participants = userShares.map(item => {
          const shareAmount = (item.shares / totalShares) * finalAmount;
          return {
            user: item.user,
            shares: item.shares,
            shareAmount: Math.round(shareAmount * 100) / 100
          };
        });
      }

      const expense = new Expense({
        group: groupId,
        title: description,
        description: notes || '',
        amount: finalAmount,
        currency,
        exchangeRate,
        amountInINR: finalAmountInINR,
        paidBy: paidByUserId,
        expenseDate: date || new Date(),
        splitType,
        participants
      });

      await expense.save();
      importedCount.expenses++;

      // Log Audit
      await createAuditLog({
        entityType: 'EXPENSE',
        entityId: expense._id.toString(),
        action: 'CREATE',
        newValue: expense.toJSON(),
        performedBy: userId
      });

      createdEntities.push({ type: 'Expense', id: expense._id });
    }
  }

  // Create Audit Log of import decision
  await createAuditLog({
    entityType: 'IMPORT',
    entityId: groupId,
    action: 'IMPORT_DECISION',
    newValue: { importedCount, createdEntitiesCount: createdEntities.length },
    performedBy: userId
  });

  return {
    success: true,
    importedCount,
    createdEntities
  };
};
