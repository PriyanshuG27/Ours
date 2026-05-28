import { BucketList } from "@/components/features/memory/BucketList";

export const metadata = {
  title: "Bucket List | Ours",
  description: "Adventures you want to have together — dream, plan, and celebrate.",
};

export default function BucketListPage() {
  return (
    <div className="min-h-screen bg-black">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-900/10 blur-[100px]" />
        <div className="absolute bottom-1/4 left-0 h-48 w-48 rounded-full bg-emerald-900/10 blur-[80px]" />
      </div>

      <div className="relative z-10">
        <BucketList />
      </div>
    </div>
  );
}
