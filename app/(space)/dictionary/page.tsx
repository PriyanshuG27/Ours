import { Dictionary } from "@/components/features/memory/Dictionary";

export const metadata = {
  title: "Our Dictionary | Ours",
  description: "Your private language — inside jokes, special words, and shared meaning.",
};

export default function DictionaryPage() {
  return (
    <div className="min-h-screen bg-black">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-indigo-900/10 blur-[100px]" />
        <div className="absolute right-0 bottom-1/3 h-48 w-48 rounded-full bg-violet-900/10 blur-[80px]" />
      </div>

      <div className="relative z-10">
        <Dictionary />
      </div>
    </div>
  );
}
