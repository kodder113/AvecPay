import Link from "next/link";

export interface LegalSection {
  title: string;
  body: string[];
}

/** Plain, readable legal page. */
export function LegalPage({ title, updated, intro, sections, back }: { title: string; updated: string; intro: string; sections: LegalSection[]; back: string }) {
  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-sm text-slate-500">{updated}</p>
        <p className="text-slate-700">{intro}</p>
      </header>
      {sections.map((s, i) => (
        <section key={s.title} className="space-y-2">
          <h2 className="text-lg font-semibold">
            {i + 1}. {s.title}
          </h2>
          {s.body.map((p, j) => (
            <p key={j} className="text-slate-700">
              {p}
            </p>
          ))}
        </section>
      ))}
      <Link href="/" className="text-brand-ink underline">
        {back}
      </Link>
    </article>
  );
}

export function supportContact(): string | null {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null;
}
