// Utilidades de fechas ISO (YYYY-MM-DD) sin problemas de zona horaria.
export const nochesEntreFechas = (a, b) => {
  if (!a || !b) return 0;
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.max(Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000), 0);
};
