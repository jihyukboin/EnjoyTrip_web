const dateTimeFormat = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

export const formatCount = (value, unit) => `${value.toLocaleString('ko-KR')}${unit}`;

// `yy.mm.dd hh:mm` 형태는 로케일 기본 패턴이 아니므로 조각을 직접 조립한다
export function formatDateTime(value) {
  const parts = Object.fromEntries(dateTimeFormat.formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]));
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
}
