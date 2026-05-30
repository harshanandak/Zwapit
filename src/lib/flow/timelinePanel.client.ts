// Browser-only interactive timeline panel (Task 9 integration).
// Renders a compact stepper + "Advance (demo)" control that drives the shared
// mock order through local state transitions. Mock-local only (no server).
import { mockPay } from "../state/orderTransitions";
import {
  buyerStageIndex,
  buyerStages,
  connectTimelineActions,
  loadDemoState,
  nextActionLabel,
  saveDemoState,
  sellerStageIndex,
  sellerStages,
  type DemoState,
} from "./mockFlow";

type Role = "buyer" | "seller";

export function mountTimelinePanel(containerId: string, role: Role): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const state: DemoState = loadDemoState();
  // My Tickets / Orders represent a paid order: advance checkout_pending to paid.
  if (state.order.state === "checkout_pending") {
    const paid = mockPay(state.order);
    state.order = paid.order;
    saveDemoState(state);
  }

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
            ? '<span class="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">✓</span>'
            : index === active
              ? `<span class="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">${index + 1}</span>`
              : `<span class="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-xs font-semibold text-slate-400">${index + 1}</span>`;
        const text =
          index === active
            ? `<span class="font-semibold text-slate-900">${label}</span>`
            : `<span class="text-slate-500">${label}</span>`;
        return `<li class="flex flex-1 items-center gap-2">${node}${text}</li>`;
      })
      .join("");

    const next = nextActionLabel(state.order.state);
    const action = next
      ? `<button data-advance class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Advance (demo)</button>
         <p class="mt-1 text-xs text-slate-500">Next: ${next}</p>`
      : '<p class="text-sm font-semibold text-emerald-700">Completed ✓</p>';

    container!.innerHTML = `
      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold text-slate-900">${title}</p>
          <span class="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">${statusLabel}</span>
        </div>
        <ol class="mt-3 flex items-center gap-2 text-xs">${dots}</ol>
        <div class="mt-4">${action}</div>
      </div>`;

    const button = container!.querySelector<HTMLButtonElement>("button[data-advance]");
    button?.addEventListener("click", () => {
      try {
        const result = connectTimelineActions(state.order, state.transferTask);
        state.order = result.order;
        state.transferTask = result.transferTask;
        saveDemoState(state);
        render();
      } catch (error) {
        const note = document.createElement("p");
        note.className = "mt-2 text-xs text-slate-500";
        note.textContent = `Can't advance: ${(error as Error).message}`;
        container!.appendChild(note);
      }
    });
  }

  render();
}
