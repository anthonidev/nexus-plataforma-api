export const formatUserPointResponse = (userPoints: any) => {
  return userPoints
  ? {
      availablePoints: userPoints.availablePoints,
      totalEarnedPoints: userPoints.totalEarnedPoints,
      totalWithdrawnPoints: userPoints.totalWithdrawnPoints,
    }
  : {
      availablePoints: 0,
      totalEarnedPoints: 0,
      totalWithdrawnPoints: 0,
    };
};