export const formatRankUserResponse = (userRank: any) => {
  return userRank
    ? {
        current: {
          id: userRank.currentRank.id,
          name: userRank.currentRank.name,
          code: userRank.currentRank.code,
          requiredPoints: userRank.currentRank.requiredPoints,
          requiredDirects: userRank.currentRank.requiredDirects,
        },
        highest: userRank.highestRank
          ? {
              id: userRank.highestRank.id,
              name: userRank.highestRank.name,
              code: userRank.highestRank.code,
              requiredPoints: userRank.highestRank.requiredPoints,
              requiredDirects: userRank.highestRank.requiredDirects,
            }
          : null,
      }
    : null;
};