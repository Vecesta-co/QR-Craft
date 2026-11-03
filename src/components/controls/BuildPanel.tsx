"use client";

import { BUILD_PHASES, PHASE_LABELS, type BuildPhase } from "@/lib/world/types";
import type { SceneScore } from "@/lib/world/types";
import { useQrCraft } from "@/state/useQrCraft";

const SPEEDS = [1, 2, 4, 8];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function phaseState(
  phase: BuildPhase,
  current: string,
  status: string,
): "done" | "active" | "pending" {
  const currentIndex = BUILD_PHASES.indexOf(current as BuildPhase);
  const phaseIndex = BUILD_PHASES.indexOf(phase);
  if (status === "complete") return "done";
  if (currentIndex < 0) return "pending";
  if (phaseIndex < currentIndex) return "done";
  if (phaseIndex === currentIndex) return "active";
  return "pending";
}

function ScoreRow({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="score-row" title={note}>
      <div className="score-row__head">
        <span>{label}</span>
        <span className="numeric">{value}</span>
      </div>
      <div className="meter">
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function scoreRows(score: SceneScore) {
  return [
    ["Landmark prominence", score.landmarkProminence, score.notes.landmarkProminence],
    ["Vertical hierarchy", score.verticalHierarchy, score.notes.verticalHierarchy],
    ["Material coherence", score.materialCoherence, score.notes.materialCoherence],
    ["Density balance", score.densityBalance, score.notes.densityBalance],
    ["QR coverage", score.qrCoverage, score.notes.qrCoverage],
  ] as const;
}

export function BuildPanel() {
  const result = useQrCraft((state) => state.result);
  const engine = useQrCraft((state) => state.engine);
  const builder = useQrCraft((state) => state.builder);

  if (!result) {
    return (
      <div className="empty-panel">
        <span className="empty-panel__mark">⌂</span>
        <h3>No site plan yet</h3>
        <p>Generate a kingdom to compile the construction task graph.</p>
      </div>
    );
  }

  const { brief, stats, plan, layout } = result;
  const progress = Math.round(builder.progress * 1000) / 10;
  const currentIndex = builder.taskIndex;
  const tasks = plan.tasks;
  const windowStart = Math.max(0, Math.min(currentIndex - 2, tasks.length - 5));
  const visibleTasks = tasks.slice(windowStart, windowStart + 5);

  return (
    <div className="build-panel">
      <section className="panel-section">
        <div className="section-heading">
          <h3>Construction</h3>
          <span className={`state-pill state-pill--${builder.status}`}>{builder.status}</span>
        </div>
        <p className="task-label">{builder.taskLabel}</p>
        <div className="progress-block">
          <div className="progress-block__numbers">
            <span>{progress.toFixed(1)}%</span>
            <span className="numeric">
              {formatNumber(builder.appliedBlocks)} / {formatNumber(builder.totalBlocks)} blocks
            </span>
          </div>
          <div className="progress-bar">
            <span style={{ width: `${Math.max(progress, 0.5)}%` }} />
          </div>
        </div>

        <div className="phase-strip" aria-label="Construction phases">
          {BUILD_PHASES.map((phase) => (
            <div
              key={phase}
              className={`phase-chip phase-chip--${phaseState(phase, builder.phase, builder.status)}`}
              title={PHASE_LABELS[phase]}
            >
              <span>{PHASE_LABELS[phase]}</span>
            </div>
          ))}
        </div>

        <div className="button-row">
          {builder.status === "building" && (
            <button type="button" className="button button--ghost" onClick={() => engine?.pause()}>
              Pause
            </button>
          )}
          {builder.status === "paused" && (
            <button type="button" className="button button--primary" onClick={() => engine?.resume()}>
              Resume
            </button>
          )}
          {(builder.status === "building" || builder.status === "paused") && (
            <button type="button" className="button button--danger-ghost" onClick={() => engine?.cancel()}>
              Cancel
            </button>
          )}
          {builder.status === "complete" && (
            <span className="inline-note inline-note--success">
              Complete. The live top view will be certified automatically.
            </span>
          )}
          {builder.status === "cancelled" && (
            <span className="inline-note inline-note--danger">
              Construction stopped. The partial world is still explorable; exports stay locked until a
              complete build exists.
            </span>
          )}
        </div>

        <div className="speed-row">
          <span className="field__label">Builder speed</span>
          <div className="segmented segmented--compact">
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                className={`segmented__item ${builder.speed === speed ? "is-selected" : ""}`}
                onClick={() => engine?.setSpeed(speed)}
                disabled={!engine || builder.status === "complete" || builder.status === "cancelled"}
              >
                {speed}×
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <h3>Task queue</h3>
          <span className="muted numeric">
            {Math.min(currentIndex + 1, tasks.length)} / {tasks.length}
          </span>
        </div>
        <ul className="task-list">
          {visibleTasks.map((task, offset) => {
            const index = windowStart + offset;
            const state =
              builder.status === "complete"
                ? "done"
                : index < currentIndex
                  ? "done"
                  : index === currentIndex
                    ? "active"
                    : "pending";
            return (
              <li key={task.id} className={`task-item task-item--${state}`}>
                <span className="task-item__dot" />
                <span className="task-item__label">{task.label}</span>
                <span className="task-item__count numeric">{formatNumber(task.blocks.length)}</span>
              </li>
            );
          })}
        </ul>
        <p className="panel-footnote">
          Each task is a real dependency-ordered chunk of placements. The builder applies them to the
          same voxel world used for exploration and export.
        </p>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <h3>World brief</h3>
          <span className="muted">{brief.styleLabel}</span>
        </div>
        <p className="brief-summary">{brief.summary}</p>
        <dl className="stat-grid">
          <div>
            <dt>Structures</dt>
            <dd>{formatNumber(stats.structures)}</dd>
          </div>
          <div>
            <dt>Buildings</dt>
            <dd>{formatNumber(stats.buildings)}</dd>
          </div>
          <div>
            <dt>Towers</dt>
            <dd>{formatNumber(stats.towers)}</dd>
          </div>
          <div>
            <dt title="All solid voxels in the completed world, including terrain and foundations">
              World blocks
            </dt>
            <dd>{formatNumber(stats.totalBlocks)}</dd>
          </div>
          <div>
            <dt>City ground</dt>
            <dd>{layout.citySize}²</dd>
          </div>
          <div>
            <dt>Peak Y</dt>
            <dd>{stats.tallestY}</dd>
          </div>
        </dl>
        <div className="tag-list">
          {brief.districts.map((district) => (
            <span key={district} className="tag">
              {district}
            </span>
          ))}
        </div>
        <div className="tag-list">
          {brief.infrastructure.map((item) => (
            <span key={item} className="tag tag--quiet">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <h3>Scene score</h3>
          <span className="numeric score-total">{plan.score.total}</span>
        </div>
        <div className="score-list">
          {scoreRows(plan.score).map(([label, value, note]) => (
            <ScoreRow key={label} label={label} value={value} note={note} />
          ))}
        </div>
        <p className="panel-footnote">{plan.score.notes.disclaimer}</p>
      </section>
    </div>
  );
}
