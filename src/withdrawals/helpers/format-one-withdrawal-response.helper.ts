export const formatOneWithdrawalResponse = (withdrawal) => {
  return {
    id: withdrawal.id,
    amount: withdrawal.amount,
    status: withdrawal.status,
    createdAt: withdrawal.createdAt,
    metadata: withdrawal.metadata,
    bankName: withdrawal.bankName,
    accountNumber: withdrawal.accountNumber,
    cci: withdrawal.cci,
    user: {
      id: withdrawal.user.id,
      email: withdrawal.user.email,
      personalInfo: {
        firstName: withdrawal.user.personalInfo?.firstName,
        lastName: withdrawal.user.personalInfo?.lastName,
        documentNumber: withdrawal.user.personalInfo?.documentNumber,
      },
      bankInfo: {
        bankName: withdrawal.bankName,
        accountNumber: withdrawal.accountNumber,
        cci: withdrawal.cci,
      },
    },

    reviewedBy: withdrawal.reviewedBy
      ? {
        id: withdrawal.reviewedBy.id,
        email: withdrawal.reviewedBy.email,
      }
      : null,


    withdrawalPoints: withdrawal.withdrawalPoints.map((wp) => {
      return {
        id: wp.id,
        amountUsed: wp.amountUsed,
        points: {
          id: wp.points.id,
          type: wp.points.type,
          amount: wp.points.amount,
          withdrawnAmount: wp.points.withdrawnAmount,
          pendingAmount: wp.points.pendingAmount,
          status: wp.points.status,
          metadata: wp.points.metadata,
          createdAt: wp.points.createdAt,
          isArchived: wp.points.isArchived,
        },
      };
    }),
  };
};