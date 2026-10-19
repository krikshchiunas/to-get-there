"use client";

/**
 * Последний рубеж: упал сам корневой макет. Здесь нет ни шрифта, ни
 * стилей приложения, поэтому страница самодостаточна — простой HTML с
 * встроенными стилями и кнопкой «Обновить».
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#ffffff",
          color: "#101418",
          padding: "24px",
        }}
      >
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>To Get There не загрузился</h1>
          <p style={{ fontSize: 15, lineHeight: 1.5, color: "#5b6472", margin: "0 0 20px" }}>
            Это наша ошибка, не твоя. Обнови страницу через минуту.
            {error.digest ? ` Код: ${error.digest}` : ""}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              height: 44,
              padding: "0 20px",
              borderRadius: 999,
              border: 0,
              background: "#2f3bee",
              color: "#ffffff",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Обновить
          </button>
        </main>
      </body>
    </html>
  );
}
