import { w } from "@faker-js/faker/dist/airline-CBNP41sR";

export const formatOneWithdrawalResponse = (withdrawal) => {
  return {
    id: withdrawal.id,
    amount: withdrawal.amount,
    status: withdrawal.status,
    createdAt: withdrawal.createdAt,
    metadata: withdrawal.metadata,

    user: {
      id: withdrawal.user.id,
      email: withdrawal.user.email,
      personalInfo: {
        firstName: withdrawal.user.personalInfo?.firstName,
        lastName: withdrawal.user.personalInfo?.lastName,
        documentNumber: withdrawal.user.personalInfo?.documentNumber,
      },
    },

    reviewedBy: withdrawal.reviewedBy
      ? {
          id: withdrawal.reviewedBy.id,
          email: withdrawal.reviewedBy.email,
        }
      : null,

    bankInfo: {
      bankName: withdrawal.bankName,
      accountNumber: withdrawal.accountNumber,
      cci: withdrawal.cci,
    },
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
        },
      };
    }),
  };
};