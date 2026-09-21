import Link from 'next/link';
import type { StageStatus } from '@/lib/hiring';
import { isComplete, isSelectable, stageCardActionLabel } from '@/lib/candidate-portal-state';

type ProgressStage = { key: string; title: string; order: number; status: StageStatus; isCurrent: boolean };
export function PortalProgress({ portalStages, selectedStageOrder, progressPercent }: {
  portalStages: ProgressStage[]; selectedStageOrder?: number; progressPercent: number;
}) {
  return (
          <aside
            className="card p-5 sm:p-6 lg:col-start-2 lg:row-span-3 lg:row-start-1"
            aria-labelledby="portal-progress-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-bold uppercase tracking-[0.18em] text-accent">
                  Progress
                </p>
                <h2
                  id="portal-progress-title"
                  className="mt-2 text-xl font-bold tracking-tight text-ink"
                >
                  Application progress
                </h2>
              </div>
              <p className="text-sm font-bold text-slate-700">
                {progressPercent}%
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {portalStages.map((definition) => {
                const selected = selectedStageOrder === definition.order;
                const selectable = isSelectable(definition.status);
                const href = `/track/portal?stage=${definition.order}#selected-stage-title`;
                const cardClassName = `flex items-start gap-3 rounded-2xl border p-3 text-left transition ${
                  selected
                    ? "border-brand bg-brand/5 shadow-sm ring-2 ring-brand/20"
                    : selectable
                      ? "border-slate-200 bg-white hover:border-brand/60 hover:bg-slate-50"
                      : "border-slate-100 bg-slate-50 opacity-75"
                }`;
                const content = (
                  <>
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isComplete(definition.status)
                          ? "bg-emerald-600 text-white"
                          : definition.isCurrent
                            ? "bg-brand text-white"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {definition.order}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-ink">
                          {definition.title}
                        </p>
                        {definition.isCurrent ? (
                          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">
                            Current
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {definition.status}
                      </p>
                      <p
                        className={`mt-2 text-xs font-bold ${selected ? "text-brand" : selectable ? "text-slate-600" : "text-slate-400"}`}
                      >
                        {stageCardActionLabel(definition.status, selected)}
                      </p>
                    </div>
                  </>
                );

                return selectable ? (
                  <Link
                    className={cardClassName}
                    href={href}
                    key={definition.key}
                    aria-current={selected ? "step" : undefined}
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    className={cardClassName}
                    key={definition.key}
                    aria-disabled="true"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </aside>
  );
}
