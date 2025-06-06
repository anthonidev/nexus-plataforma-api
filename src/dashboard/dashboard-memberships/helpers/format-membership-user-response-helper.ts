export const formatMembershipUserResponse = (membership: any) => {
  return membership
    ? {
        id: membership.id,
        plan: {
          id: membership.plan.id,
          name: membership.plan.name,
          price: membership.plan.price,
          binaryPoints: membership.plan.binaryPoints,
        },
        startDate: membership.startDate,
        endDate: membership.endDate,
        autoRenewal: membership.autoRenewal,
      }
    : null;
};
