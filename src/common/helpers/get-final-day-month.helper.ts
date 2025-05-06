export const getFinalDayMonth = () => {
  return new Date().toISOString().slice(0, 10);
};