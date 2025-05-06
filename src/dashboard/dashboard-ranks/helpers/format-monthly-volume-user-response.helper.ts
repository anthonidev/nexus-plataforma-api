export const formatMonthlyVolumeUserResponse = (monthlyVolume: any) => {
  return monthlyVolume
  ? {
      leftVolume: monthlyVolume.leftVolume,
      rightVolume: monthlyVolume.rightVolume,
      totalVolume: monthlyVolume.totalVolume,
      leftDirects: monthlyVolume.leftDirects,
      rightDirects: monthlyVolume.rightDirects,
      totalDirects:
        (monthlyVolume.leftDirects || 0) +
        (monthlyVolume.rightDirects || 0),
      monthStartDate: monthlyVolume.monthStartDate,
      monthEndDate: monthlyVolume.monthEndDate,
    }
  : null;
};