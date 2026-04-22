const financeRecalculator = (finance) => {
  let totalPaid = 0;
  let totalAmount = 0;

  finance.items.forEach((item) => {
    totalAmount += item.amount;
    totalPaid += item.paidAmount;

    if (item.paidAmount === 0) {
      item.status = "Unpaid";
    } else if (item.paidAmount < item.amount) {
      item.status = "Partial";
    } else {
      item.status = "Paid";
    }
  });

  finance.totalAmount = totalAmount + (finance.carriedOverBalance || 0); // ← include debt;
  finance.totalPaid = totalPaid;
  finance.outstandingBalance = totalAmount - totalPaid;

  if (finance.outstandingBalance === 0) {
    finance.paymentStatus = "Paid";
  } else if (totalPaid === 0) {
    finance.paymentStatus = "Unpaid";
  } else {
    finance.paymentStatus = "Partial";
  }
};

module.exports = financeRecalculator;
