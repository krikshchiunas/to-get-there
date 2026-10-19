import { formatParticipants, formatPlaces, formatSeats, seatsLeft } from "@/lib/format";

/**
 * Вместимость — это текст, а не графика. Раньше здесь был ряд точек-мест;
 * в ленте он соревновался за внимание с названием идеи и временем, а решение
 * «успею ли я» принимается по числу. Точки убраны вместе с остальным
 * украшательством.
 */
export function Seats({
  count,
  max,
  className = "",
}: {
  count: number;
  max: number | null;
  className?: string;
}) {
  if (max == null) {
    return <span className={className}>{formatParticipants(count)}</span>;
  }

  const left = seatsLeft({ max_participants: max }, count) ?? 0;

  if (left === 0) {
    return <span className={`text-heat ${className}`}>мест нет</span>;
  }

  return (
    <span className={className}>
      <span className="u-tnum">{formatPlaces(left)}</span> свободно
      <span className="sr-only">, занято {formatSeats(count, max)}</span>
    </span>
  );
}
