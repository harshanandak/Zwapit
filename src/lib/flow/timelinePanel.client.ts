// Browser-only interactive timeline panel (Task 9 integration).
// Renders a compact stepper + "Advance (demo)" control that drives the shared
// mock order through local state transitions. Mock-local only (no server).
import {
  buyerStageIndex,
  buyerStages,
  loadDemoState,
  nextActionLabel,
  sellerStageIndex,
  sellerStages,
  type DemoState,
} from "./mockFlow";
import { loadBuyerOrderState, runAdvanceTimeline } from "../convex/dataAdapter";

type Role = "buyer" | "seller";

export function mountTimelinePanel(containerId: string, role: Role): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  // First paint uses the local/seeded demo state so the screen is never blank
  // and never shows a new product state. When Convex is configured the state is
  // then hydrated from the backend (see the loadBuyerOrderState() call below).
  let state: DemoState = loadDemoState();

  const stages = role === "seller" ? sellerStages : buyerStages;
  const indexOf = role === "seller" ? sellerStageIndex : buyerStageIndex;
  const title = role === "seller" ? "Order status" : "Your ticket status";

  function render(): void {
    const active = indexOf(state.order.state);
    const statusLabel = stages[Math.min(active, stages.length - 1)];

    const dots = stages
      .map((label, index) => {
        const node =
          index < active
            ? '<span class="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">✓</span>'
            : index === active
              ? `<span class="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">${index + 1}</span>`
              : `<span class="flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground">${index + 1}</span>`;
        const text =
          index === active
            ? `<span class="font-semibold text-foreground">${label}</span>`
            : `<span class="text-muted-foreground">${label}</span>`;
        return `<li class="flex flex-1 items-center gap-2">${node}${text}</li>`;
      })
      .join("");

    const next = nextActionLabel(state.order.state);
    const canAdvance =
      (role === "seller" && state.order.state === "transfer_pending") ||
      (role === "buyer" &&
        (state.order.state === "transfer_submitted" ||
          state.order.state === "buyer_confirmed" ||
          state.order.state === "dispute_window_open"));
    const action = next
      ? canAdvance
        ? `<button data-advance class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm">Advance (demo)</button>
           <p class="mt-1 text-xs text-muted-foreground">Next: ${next}</p>`
        : `<p class="text-sm font-medium text-muted-foreground">Next: ${next}</p>`
      : state.order.state === "issue_reported"
        ? '<p class="text-sm font-semibold text-amber-700">Issue reported. Protection is active.</p>'
        : state.order.state === "completed"
          ? '<p class="text-sm font-semibold text-foreground">Completed</p>'
          : '<p class="text-sm font-medium text-muted-foreground">No timeline action available.</p>';

    container!.innerHTML = `
      <div class="rounded-xl border border-border bg-card p-4">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold text-foreground">${title}</p>
          <span class="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">${statusLabel}</span>
        </div>
        <ol class="mt-3 flex items-center gap-2 text-xs">${dots}</ol>
        <div class="mt-4">${action}</div>
      </div>`;

    const button = container!.querySelector<HTMLButtonElement>("button[data-advance]");
    button?.addEventListener("click", () => {
      if (button) button.disabled = true;
      // runAdvanceTimeline persists through Convex when configured and otherwise
      // falls back to the existing local transition + localStorage behavior.
      void runAdvanceTimeline(state, { submittedAt: new Date().toISOString(), actorRole: role })
        .then((result) => {
          state = { order: result.order, transferTask: result.transferTask };
          render();
        })
        .catch((error) => {
          if (button) button.disabled = false;
          const note = document.createElement("p");
          note.className = "mt-2 text-xs text-muted-foreground";
          note.textContent = `Can't advance: ${(error as Error).message}`;
          container!.appendChild(note);
        });
    });
  }

  render();

  // Hydrate from Convex when configured; a no-op (returns the same local state)
  // otherwise, so behavior is unchanged when Convex is not set up locally.
  void loadBuyerOrderState()
    .then((loaded) => {
      state = loaded;
      render();
    })
    .catch(() => {
      // Keep the first-paint local state on any error.
    });
}
