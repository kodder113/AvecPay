"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/LangProvider";

export function RemindButton({ id, sent }: { id: string; sent: number }) {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done" | string>("idle");
  return (
    <button
      type="button"
      className="text-sm font-semibold text-brand-ink underline disabled:no-underline disabled:opacity-60"
      disabled={state === "busy" || state === "done"}
      onClick={async () => {
        setState("busy");
        const res = await fetch(`/api/cobros/charges/${id}/remind`, { method: "POST" });
        if (res.ok) {
          setState("done");
          router.refresh();
        } else setState((await res.json().catch(() => ({}))).error ?? "Error");
      }}
    >
      {state === "busy"
        ? "…"
        : state === "done"
          ? t({ es: "Enviado ✓", en: "Sent ✓" })
          : state !== "idle"
            ? state
            : sent
              ? t({ es: `Recordar otra vez (${sent})`, en: `Remind again (${sent})` })
              : t({ es: "Enviar recordatorio", en: "Send reminder" })}
    </button>
  );
}

/** Weekly AI report and questions about the business's own numbers. */
export function AiPanel({ report, reportDate, history, ready }: { report: string | null; reportDate: string | null; history: { q: string; a: string }[]; ready: boolean }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState<"report" | "ask" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ q: string; a: string } | null>(null);

  async function post(path: string, body: unknown): Promise<string | null> {
    setError(null);
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Error");
      return null;
    }
    return data.answer as string;
  }

  return (
    <section className="card space-y-4 border-2 border-brand-ink">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">✨ {t({ es: "Reporte con IA", en: "AI report" })}</h2>
        {ready && (
          <button
            type="button"
            className="btn-secondary py-2 text-sm"
            disabled={Boolean(busy)}
            onClick={async () => {
              setBusy("report");
              if (await post("/api/ai/weekly", {})) router.refresh();
              setBusy(null);
            }}
          >
            {busy === "report" ? t({ es: "Analizando…", en: "Analyzing…" }) : t({ es: "Hacer reporte ahora", en: "Make report now" })}
          </button>
        )}
      </div>
      {!ready ? (
        <p className="text-sm text-slate-600">{t({ es: "Los reportes con IA se activan pronto.", en: "AI reports are coming soon." })}</p>
      ) : report ? (
        <div>
          {reportDate && <p className="mb-1 text-xs text-slate-500">{reportDate}</p>}
          <SimpleMarkdown text={report} />
        </div>
      ) : (
        <p className="text-sm text-slate-600">{t({ es: "Cada lunes te llega un resumen de tu semana. También puedes hacerlo ahora.", en: "Every Monday you get a summary of your week. You can also make one now." })}</p>
      )}
      {ready && (
        <form
          className="space-y-2 border-t border-slate-100 pt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy("ask");
            const a = await post("/api/ai/ask", { question });
            if (a) {
              setAnswer({ q: question, a });
              setQuestion("");
            }
            setBusy(null);
          }}
        >
          <label className="label" htmlFor="ask">{t({ es: "Pregúntale a tus números", en: "Ask your numbers" })}</label>
          <div className="flex gap-2">
            <input id="ask" className="input" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} placeholder={t({ es: "¿Cuánto cobró Miguel este mes?", en: "How much did Miguel collect this month?" })} />
            <button className="btn-primary shrink-0" disabled={question.trim().length < 3 || Boolean(busy)}>
              {busy === "ask" ? "…" : t({ es: "Preguntar", en: "Ask" })}
            </button>
          </div>
        </form>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {[...(answer ? [answer] : []), ...history].slice(0, 3).map((x, i) => (
        <div key={i} className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="font-semibold">{x.q}</p>
          <div className="mt-1 text-slate-700">
            <SimpleMarkdown text={x.a} />
          </div>
        </div>
      ))}
    </section>
  );
}

/** Just enough markdown for AI reports: headings, bullets, **bold**. Rendered as text, never HTML. */
function SimpleMarkdown({ text }: { text: string }) {
  const bold = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : part));
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) blocks.push(<ul key={`u${blocks.length}`} className="ml-5 list-disc space-y-0.5">{bullets.map((b, i) => <li key={i}>{bold(b)}</li>)}</ul>);
    bullets = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (/^[-*•]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*•]\s+/, ""));
      continue;
    }
    flush();
    if (!line) continue;
    const h = /^#{1,4}\s+(.*)$/.exec(line);
    blocks.push(h ? <p key={blocks.length} className="pt-2 font-bold text-slate-900">{bold(h[1])}</p> : <p key={blocks.length}>{bold(line.replace(/^\d+\.\s+/, ""))}</p>);
  }
  flush();
  return <div className="space-y-1 text-sm leading-relaxed text-slate-800">{blocks}</div>;
}
