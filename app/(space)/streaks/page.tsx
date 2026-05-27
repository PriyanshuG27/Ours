import { Metadata } from "next";
import { StreakList } from "@/components/features/streaks/StreakList";

export const metadata: Metadata = {
  title: "Streaks | Ours",
  description: "Peer-validated daily habits",
};

export default function StreaksPage() {
  return (
    <div className="flex flex-col flex-1 h-full w-full max-w-md mx-auto p-4 animate-in fade-in pt-8">
      <header className="mb-8 px-1">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">Streaks</h1>
        <p className="text-zinc-400 text-sm mt-1">Keep each other accountable.</p>
      </header>

      <StreakList />
    </div>
  );
}
