import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SpaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: spaces } = await supabase
    .from("spaces")
    .select("id")
    .eq("is_active", true)
    .limit(1);

  if (!spaces || spaces.length === 0) {
    redirect("/setup");
  }

  return <>{children}</>;
}
