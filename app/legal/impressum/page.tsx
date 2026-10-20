import type { Metadata } from "next";
import { DocTitle, Prose } from "@/components/legal/prose";
import { Icon } from "@/components/ui/icon";
import { getOperator, LEGAL_REVISION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Angaben gemäß § 5 DDG.",
};

export default function ImpressumPage() {
  const operator = getOperator();

  return (
    <>
      <DocTitle title="Impressum" subtitle="Angaben gemäß § 5 DDG" revision={LEGAL_REVISION} />
      {operator ? (
        <Prose>
          <h2>Anbieter</h2>
          <p>
            {operator.name}
            {operator.address.map((line) => (
              <span key={line}>
                <br />
                {line}
              </span>
            ))}
          </p>

          <h2>Kontakt</h2>
          <p>
            E-Mail: <a href={`mailto:${operator.email}`}>{operator.email}</a>
            {operator.phone ? (
              <>
                <br />
                Telefon: {operator.phone}
              </>
            ) : null}
          </p>

          {operator.vatId ? (
            <>
              <h2>Umsatzsteuer-ID</h2>
              <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: {operator.vatId}</p>
            </>
          ) : null}

          <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
          <p>{operator.contentResponsible}, Anschrift wie oben.</p>

          <h2>Inhalte von Nutzerinnen und Nutzern</h2>
          <p>
            Ideen, Nachrichten und Profile stammen von den Nutzerinnen und Nutzern selbst. Rechtswidrige
            Inhalte kann jede Person über „Пожаловаться“ melden oder per E-Mail an die oben genannte Adresse.
            Wir prüfen Meldungen unverzüglich und entfernen rechtswidrige Inhalte (Art. 16 DSA).
          </p>

          <h2>Verbraucherstreitbeilegung</h2>
          <p>
            Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </Prose>
      ) : (
        <div className="rounded-field bg-sunken p-4">
          <p className="flex items-center gap-2 text-[15px] font-medium">
            <Icon name="warning" size={17} className="shrink-0 text-heat" />
            Impressum ещё не заполнен
          </p>
          <p className="mt-1.5 text-[14px] leading-[1.5] text-ink-soft">
            Оператор сервиса должен указать имя, адрес и почту в настройках развёртывания (переменные
            LEGAL_OPERATOR_*, см. docs/LEGAL.md). Пока по вопросам о сервисе пиши через форму жалобы в
            приложении.
          </p>
        </div>
      )}
    </>
  );
}
