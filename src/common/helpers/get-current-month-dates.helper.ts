export function getCurrentMonthDates(): { start: Date; end: Date } {
  const today = new Date();

  // Primer día del mes actual
  const firstDayCurrentMonth = new Date(
    today.getFullYear(),
    today.getMonth(),
    1,
  );
  firstDayCurrentMonth.setHours(0, 0, 0, 0);

  // Último día del mes actual
  const lastDayCurrentMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  );
  lastDayCurrentMonth.setHours(23, 59, 59, 999);

  return {
    start: firstDayCurrentMonth,
    end: lastDayCurrentMonth,
  };
}