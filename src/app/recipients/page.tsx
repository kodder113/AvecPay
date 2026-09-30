import { createClient } from "@/lib/supabase/server";
import { RecipientManager } from "./RecipientManager";
import { getT } from "@/lib/i18n/server";

export default async function RecipientsPage() {
  const supabase = await createClient();
  const { t } = await getT();
  const { data } = await supabase.from("recipients").select("*").order("created_at", { ascending: false });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t({ es: "Destinatarios", en: "Recipients" })}</h1>
      <RecipientManager initial={data ?? []} />
    </div>
  );
}
