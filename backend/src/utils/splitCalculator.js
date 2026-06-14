/**
 * Decoupled Split Calculator Helper
 */
export const calculateSplits = (splitType, amount, participants) => {
  if (!participants || participants.length === 0) {
    throw new Error('Participants list is empty');
  }

  const numParticipants = participants.length;
  let calculatedParticipants = [];

  switch (splitType) {
    case 'equal': {
      const shareAmount = amount / numParticipants;
      calculatedParticipants = participants.map((p) => ({
        user: p.user,
        shareAmount: Math.round(shareAmount * 100) / 100,
      }));
      break;
    }

    case 'exact': {
      let totalExact = 0;
      calculatedParticipants = participants.map((p) => {
        if (typeof p.shareAmount !== 'number' || p.shareAmount < 0) {
          throw new Error('Each participant must have a non-negative exact share amount');
        }
        totalExact += p.shareAmount;
        return {
          user: p.user,
          shareAmount: Math.round(p.shareAmount * 100) / 100,
        };
      });

      if (Math.abs(totalExact - amount) > 0.01) {
        throw new Error(`Sum of exact split amounts (${totalExact}) must equal the total expense amount (${amount})`);
      }
      break;
    }

    case 'percentage': {
      let totalPercentage = 0;
      calculatedParticipants = participants.map((p) => {
        if (typeof p.percentage !== 'number' || p.percentage < 0) {
          throw new Error('Each participant must have a non-negative percentage');
        }
        totalPercentage += p.percentage;
        const shareAmount = (p.percentage / 100) * amount;
        return {
          user: p.user,
          percentage: p.percentage,
          shareAmount: Math.round(shareAmount * 100) / 100,
        };
      });

      if (Math.abs(totalPercentage - 100) > 0.01) {
        throw new Error(`Sum of split percentages (${totalPercentage}%) must equal exactly 100%`);
      }
      break;
    }

    case 'shares': {
      let totalShares = 0;
      participants.forEach((p) => {
        if (typeof p.shares !== 'number' || p.shares <= 0) {
          throw new Error('Each participant must have a share weight greater than 0');
        }
        totalShares += p.shares;
      });

      calculatedParticipants = participants.map((p) => {
        const shareAmount = (p.shares / totalShares) * amount;
        return {
          user: p.user,
          shares: p.shares,
          shareAmount: Math.round(shareAmount * 100) / 100,
        };
      });
      break;
    }

    default:
      throw new Error(`Unsupported split type: ${splitType}`);
  }

  // Adjust for any small floating point rounding differences by applying
  // the difference to the first participant's share
  const calculatedSum = calculatedParticipants.reduce((sum, p) => sum + p.shareAmount, 0);
  const diff = amount - calculatedSum;
  if (Math.abs(diff) > 0 && Math.abs(diff) < 0.1 && calculatedParticipants.length > 0) {
    calculatedParticipants[0].shareAmount = Math.round((calculatedParticipants[0].shareAmount + diff) * 100) / 100;
  }

  return calculatedParticipants;
};
