import { clockTime } from "../lib/format";
import { useStore } from "../store";
import { Ghost } from "./ui";

/** A quiet strip that keeps snapshot viewing from turning into editing. */
export function SnapshotBanner() {
  const { snapshot, closeSnapshot, applySnapshot } = useStore();
  if (!snapshot) return null;
  return (
    <div className="flex h-[26px] shrink-0 items-center gap-2 border-b border-line bg-elevated px-3 text-[11px] text-ink2">
      <span className="mono text-[10.5px] text-secret">{snapshot.actor === "agent" ? "A" : "H"}</span>
      <span>
        Viewing a snapshot from {clockTime(snapshot.ts)} ({snapshot.env || "default"})
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        <Ghost onClick={applySnapshot} title="Copy this snapshot's URL and method into the current request">
          Override current request
        </Ghost>
        <Ghost onClick={closeSnapshot}>Back to editing</Ghost>
      </div>
    </div>
  );
}
