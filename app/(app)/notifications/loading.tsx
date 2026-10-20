/**
 * Пока сервер собирает список — силуэт строк, а не крутилка. Только у
 * экранов-списков: у идеи и профиля его нет, чтобы «не найдено» успело
 * ответить настоящим 404 до начала потока страницы. Так
 * делают Threads и Bluesky: глаз заранее видит, где будут строки, и
 * переход не дёргается. Анимация пульса выключается при reduced motion.
 */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Загружаем…</span>
      <div className="sticky top-0 z-20 h-14 border-b border-line bg-paper/92" aria-hidden />
      <ul aria-hidden className="motion-safe:animate-pulse">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index} className="u-feed-divider flex gap-3 px-4 py-3.5">
            <span className="size-10 shrink-0 rounded-full bg-sunken" />
            <span className="min-w-0 flex-1 space-y-2 pt-0.5">
              <span className="block h-3.5 w-1/3 rounded bg-sunken" />
              <span className="block h-4 w-4/5 rounded bg-sunken" />
              <span className="block h-3.5 w-3/5 rounded bg-sunken" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
