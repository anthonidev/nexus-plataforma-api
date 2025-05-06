export const formatWeeklyVolumeUserResponse = (weeklyVolume: any) => {
  return weeklyVolume
  ? {
      leftVolume: weeklyVolume.leftVolume,
      rightVolume: weeklyVolume.rightVolume,
      total:
        Number(weeklyVolume.leftVolume) +
        Number(weeklyVolume.rightVolume),
      weekStartDate: weeklyVolume.weekStartDate,
      weekEndDate: weeklyVolume.weekEndDate,
    }
  : null;
};