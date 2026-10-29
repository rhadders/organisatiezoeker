const nl = "nl-NL";

export function formatNumber(n: number) {
  return new Intl.NumberFormat(nl).format(Math.round(n));
}

export function percent(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "";
  return new Intl.DateTimeFormat(nl, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(d));
}

export function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return "";
  return new Intl.DateTimeFormat(nl, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(d));
}

export function daysAgo(d: string | Date | null | undefined) {
  if (!d) return "";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return "vandaag";
  if (days === 1) return "gisteren";
  return `${days} d`;
}

/** "486 kerken, waarvan 421 met e-mail (87%)" */
export function withPercent(part: number, total: number) {
  return `${formatNumber(part)} (${percent(part, total)})`;
}
