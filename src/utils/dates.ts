export const getFirstDayOfWeek = (date: Date): Date => {
  const day = date.getDay();
  const diff = date.getDate() - (day === 0 ? 6 : day - 1);
  const monday = new Date(
    date.getFullYear(),
    date.getMonth(),
    diff,
    0,
    0,
    0,
    0,
  );

  return monday;
};

export const getLastDayOfWeek = (date: Date): Date => {
  const firstDay = getFirstDayOfWeek(date);

  const sunday = new Date(
    firstDay.getFullYear(),
    firstDay.getMonth(),
    firstDay.getDate() + 6,
    0,
    0,
    0,
    0,
  );

  return sunday;
};

export const getFirstDayOfPreviousWeek = (date: Date): Date => {
  const firstDayOfCurrentWeek = getFirstDayOfWeek(date);

  const firstDayOfPreviousWeek = new Date(
    firstDayOfCurrentWeek.getFullYear(),
    firstDayOfCurrentWeek.getMonth(),
    firstDayOfCurrentWeek.getDate() - 7,
    0,
    0,
    0,
    0,
  );

  return firstDayOfPreviousWeek;
};

export const getLastDayOfPreviousWeek = (date: Date): Date => {
  const firstDayOfCurrentWeek = getFirstDayOfWeek(date);

  const lastDayOfPreviousWeek = new Date(
    firstDayOfCurrentWeek.getFullYear(),
    firstDayOfCurrentWeek.getMonth(),
    firstDayOfCurrentWeek.getDate() - 1,
    0,
    0,
    0,
    0,
  );

  return lastDayOfPreviousWeek;
};

export const getFirstDayOfMonth = (date: Date): Date => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  return firstDay;
};

export const getLastDayOfMonth = (date: Date): Date => {
  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    0,
    0,
    0,
    0,
  );
  return lastDay;
};

export const getFirstDayOfPreviousMonth = (date: Date): Date => {
  const firstDayOfCurrentMonth = getFirstDayOfMonth(date);

  const lastDayOfPreviousMonth = new Date(
    firstDayOfCurrentMonth.getFullYear(),
    firstDayOfCurrentMonth.getMonth(),
    firstDayOfCurrentMonth.getDate() - 1,
    0,
    0,
    0,
    0,
  );

  return getFirstDayOfMonth(lastDayOfPreviousMonth);
};

export const getLastDayOfPreviousMonth = (date: Date): Date => {
  const firstDayOfCurrentMonth = getFirstDayOfMonth(date);

  const lastDayOfPreviousMonth = new Date(
    firstDayOfCurrentMonth.getFullYear(),
    firstDayOfCurrentMonth.getMonth(),
    firstDayOfCurrentMonth.getDate() - 1,
    0,
    0,
    0,
    0,
  );

  return lastDayOfPreviousMonth;
};

/// funcion donde paso una fecha y me devuelve la misma fecha  {startDate}  y un mes despues {endDate} y un dia despues del endDate

export const getDates = (date: Date): { startDate: Date; endDate: Date } => {
  const startDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
  const endDate = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate() - 1,
    0,
    0,
    0,
    0,
  );

  return { startDate, endDate };
};
