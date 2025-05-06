export function getCurrentWeekDates(): { start: Date; end: Date } {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = domingo, 1 = lunes, etc.

  // Calcular fecha de inicio (lunes) de la semana actual
  const monday = new Date(today);
  monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
  monday.setHours(0, 0, 0, 0);

  // Calcular fecha de fin (domingo) de la semana actual
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    start: monday,
    end: sunday,
  };
}