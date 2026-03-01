import { ActionSummary } from "../state";
import { ActiveJobState, ActiveTaskState, JobDef, SupplyDef, SupplyInventory, TaskStance } from "../../core/types";
import { formatHours } from "../../core/playerFlow";

interface AssignmentPanelProps {
  activeJob: ActiveJobState;
  job: JobDef;
  supplies: SupplyDef[];
  supplyPrices: Map<string, number>;
  truckSupplies: SupplyInventory;
  shopSupplies: SupplyInventory;
  currentTask: ActiveTaskState | null;
  lastAction: ActionSummary | null;
  onSetCartQuantity: (supplyId: string, quantity: number) => void;
  onPerformTask: (stance: TaskStance, allowOvertime?: boolean) => void;
}

export function AssignmentPanel({
  activeJob,
  job,
  supplies,
  supplyPrices,
  truckSupplies,
  shopSupplies,
  currentTask,
  lastAction,
  onSetCartQuantity,
  onPerformTask
}: AssignmentPanelProps) {
  const cartTotal = Object.entries(activeJob.supplierCart).reduce(
    (sum, [supplyId, quantity]) => sum + (supplyPrices.get(supplyId) ?? 0) * quantity,
    0
  );

  return (
    <section className="card active-job-card">
      <h2>Active Job</h2>
      <p>
        {job.name} | locked payout ${activeJob.lockedPayout} | location {activeJob.location}
      </p>
      <p>
        Quality: {activeJob.qualityPoints} | Rework: {activeJob.reworkCount} | Time: {formatHours(activeJob.actualTicksSpent)}/
        {formatHours(activeJob.plannedTicks)}
      </p>

      <div className="list">
        {activeJob.tasks.map((task) => {
          const complete = task.requiredUnits === 0 || task.completedUnits >= task.requiredUnits;
          const progress = task.requiredUnits === 0 ? 100 : Math.round((task.completedUnits / task.requiredUnits) * 100);
          const isCurrent = currentTask?.taskId === task.taskId;

          return (
            <article key={task.taskId} className={`list-item ${isCurrent ? "current-task" : ""}`}>
              <div className="task-header">
                <strong>{task.label}</strong>
                <span>
                  {task.requiredUnits === 0 ? "Not Needed" : `${task.completedUnits}/${task.requiredUnits}`}
                </span>
              </div>
              <div className="progress-bar" aria-hidden="true">
                <span style={{ width: `${complete ? 100 : progress}%` }} />
              </div>
              {isCurrent ? (
                <div className="task-actions">
                  <div className="stack-row">
                    {task.availableStances.map((stance) => (
                      <button key={stance} onClick={() => onPerformTask(stance, false)}>
                        {labelForStance(stance)}
                      </button>
                    ))}
                  </div>
                  <div className="stack-row">
                    {task.availableStances.map((stance) => (
                      <button key={`${stance}-ot`} onClick={() => onPerformTask(stance, true)}>
                        {labelForStance(stance)} + OT
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {activeJob.location === "supplier" ? (
        <section className="supplier-panel">
          <h3>Supplier Cart</h3>
          <div className="list">
            {supplies.map((supply) => {
              const quantity = activeJob.supplierCart[supply.id] ?? 0;
              const price = supplyPrices.get(supply.id) ?? supply.price;
              return (
                <article key={supply.id} className="list-item compact-item">
                  <div>
                    <strong>{supply.name}</strong>
                    <p>{supply.flavor.description}</p>
                    <p>
                      ${price} | cart {quantity}
                    </p>
                  </div>
                  <div className="stack-row">
                    <button onClick={() => onSetCartQuantity(supply.id, Math.max(0, quantity - 1))}>-</button>
                    <button onClick={() => onSetCartQuantity(supply.id, quantity + 1)}>+</button>
                  </div>
                </article>
              );
            })}
          </div>
          <p>Cart total: ${cartTotal}</p>
        </section>
      ) : null}

      <section className="inventory-grid">
        <div>
          <h3>Truck</h3>
          <InventoryList inventory={truckSupplies} />
        </div>
        <div>
          <h3>Home Stock</h3>
          <InventoryList inventory={shopSupplies} />
        </div>
        <div>
          <h3>Site Stock</h3>
          <InventoryList inventory={activeJob.siteSupplies} />
        </div>
      </section>

      {lastAction ? (
        <section className="last-action">
          <h3>{lastAction.title}</h3>
          {lastAction.lines.map((line, index) => (
            <p key={`${lastAction.digest}-${index}`}>{line}</p>
          ))}
        </section>
      ) : null}
    </section>
  );
}

function labelForStance(stance: TaskStance): string {
  if (stance === "rush") {
    return "Rush";
  }
  if (stance === "careful") {
    return "Careful";
  }
  return "Standard";
}

function InventoryList({ inventory }: { inventory: SupplyInventory }) {
  const entries = Object.entries(inventory).filter(([, quantity]) => quantity > 0);
  if (entries.length === 0) {
    return <p>None</p>;
  }
  return (
    <div className="list">
      {entries.map(([supplyId, quantity]) => (
        <p key={supplyId}>
          {supplyId}: {quantity}
        </p>
      ))}
    </div>
  );
}
