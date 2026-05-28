import { MemoryWall } from "@/components/features/memory/MemoryWall";
import { CaptureInitiator } from "@/components/features/memory/CaptureInitiator";

export const metadata = {
  title: "Memory Wall | Ours",
  description: "Your curated wall of pinned memories and coordinated captures.",
};

export default function MemoryWallPage() {
  return (
    <div className="min-h-screen bg-black">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-rose-900/10 blur-[100px]" />
        <div className="absolute right-0 top-1/3 h-48 w-48 rounded-full bg-amber-900/10 blur-[80px]" />
      </div>

      <div className="relative z-10">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-neutral-100">
              Memory Wall
            </h1>
            <CaptureInitiator />
          </div>
          <MemoryWall />
        </div>
      </div>
    </div>
  );
}
