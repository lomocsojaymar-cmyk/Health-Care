import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { providerStats } from "@/lib/scheduling";
import { EntityBadge } from "@/components/ui";
import { HoursEditor, ProviderEditor } from "../provider-editor";
import { ProviderStatusControls } from "./status-controls";

export const dynamic = "force-dynamic";

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function ProviderManagePage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  await requireStaff();
  const { providerId } = await params;
  const db = readDb();
  const provider = db.providers.find((p) => p.id === providerId);
  if (!provider) notFound();

  const templates = db.availabilityTemplates.filter((t) => t.providerId === providerId);
  const initialWindows = DOW.map((_, weekday) => {
    const t = templates.find((x) => x.weekday === weekday);
    return t ? `${t.startTime}-${t.endTime}` : "";
  });
  const stats = providerStats(db, providerId);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="small muted" style={{ margin: 0 }}>
            <Link href="/staff/providers">← All providers</Link>
          </p>
          <h1 className="mt-0 mb-0">{provider.fullName}</h1>
          <p className="sub">{provider.credentials} · {provider.specialty}</p>
        </div>
        <span className="spacer" />
        <EntityBadge status={provider.status} />
        <ProviderStatusControls providerId={provider.id} status={provider.status} />
      </div>

      <div className="stat-row">
        <div className="stat"><div className="label">Total appointments</div><div className="value">{stats.total}</div></div>
        <div className="stat"><div className="label">Completed</div><div className="value ok">{stats.completed}</div></div>
        <div className="stat"><div className="label">No-shows</div><div className="value warn">{stats.noShows}</div></div>
        <div className="stat"><div className="label">Completion rate</div><div className="value">{stats.completionRate}%</div></div>
      </div>

      <HoursEditor
        providerId={provider.id}
        initialWindows={initialWindows}
        slotMinutes={provider.slotMinutes}
        bufferMinutes={provider.bufferMinutes}
      />
    </div>
  );
}
