"use client";

import { useEffect, useState } from "react";
import { Task, SkipRequest } from "@/types/app.types";
import { TaskCard } from "./TaskCard";
import { useE2EEKey } from "@/hooks/use-e2ee-key";
import { useSpaceStore } from "@/store/space.store";
import { supabase } from "@/lib/supabase/client";

export function StreakList() {
  const { encrypt } = useE2EEKey();
  const { userId, partnerName } = useSpaceStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [skipRequests, setSkipRequests] = useState<SkipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) {
        throw new Error("Failed to load tasks");
      }
      const data = await res.json();
      setTasks(data.tasks);
      setSkipRequests(data.skipRequests);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel("streaks-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        fetchTasks();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "skip_requests" }, () => {
        fetchTasks();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_completions" }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isCoop, setIsCoop] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setIsCreating(true);
    try {
      const encryptedTitle = await encrypt(newTaskTitle.trim());
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: encryptedTitle, isCoop }),
      });
      if (res.ok) {
        setNewTaskTitle("");
        setIsCoop(false);
        fetchTasks();
      }
    } catch {} finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return <div className="text-zinc-500 animate-pulse">Loading streaks...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  const myTasks = tasks.filter((t) => !t.is_coop && t.owner_id === userId);
  const partnerTasks = tasks.filter((t) => !t.is_coop && t.owner_id !== userId);
  const sharedTasks = tasks.filter((t) => t.is_coop);

  return (
    <div className="flex flex-col gap-8 w-full max-w-xl mx-auto pb-24">
      {/* Create New Task */}
      <form onSubmit={handleCreateTask} className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="New daily habit..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-700"
          />
          <button
            type="submit"
            disabled={!newTaskTitle.trim() || isCreating}
            className="bg-zinc-100 text-zinc-900 px-6 font-medium rounded-xl hover:bg-white transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <label className="flex items-center gap-2 px-1 text-sm text-zinc-400 cursor-pointer w-max">
          <input
            type="checkbox"
            checked={isCoop}
            onChange={(e) => setIsCoop(e.target.checked)}
            className="rounded border-zinc-700 bg-zinc-900 text-violet-500 focus:ring-violet-500/20"
          />
          <span>Shared / Co-op Habit</span>
        </label>
      </form>

      {/* Shared Streaks */}
      {sharedTasks.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-violet-400 px-1">Our Streaks</h2>
          {sharedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              skipRequests={skipRequests}
              isOwner={task.owner_id === userId} // Owner is who created it, but for co-op this only matters for skip logic maybe
              currentUserId={userId || ""}
              onActionComplete={fetchTasks}
            />
          ))}
        </div>
      )}

      {/* My Tasks */}
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-zinc-100 px-1">My Streaks</h2>
        {myTasks.length === 0 ? (
          <p className="text-zinc-500 text-sm px-1">You haven&apos;t started any personal streaks yet.</p>
        ) : (
          myTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              skipRequests={skipRequests}
              isOwner={true}
              currentUserId={userId || ""}
              onActionComplete={fetchTasks}
            />
          ))
        )}
      </div>

      {/* Partner's Tasks */}
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-zinc-100 px-1">
          {partnerName ? `${partnerName}'s Streaks` : "Partner's Streaks"}
        </h2>
        {partnerTasks.length === 0 ? (
          <p className="text-zinc-500 text-sm px-1">No streaks started yet.</p>
        ) : (
          partnerTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              skipRequests={skipRequests}
              isOwner={false}
              currentUserId={userId || ""}
              onActionComplete={fetchTasks}
            />
          ))
        )}
      </div>
    </div>
  );
}
