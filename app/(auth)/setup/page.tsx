import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SpaceSetup } from "@/components/features/auth/SpaceSetup";

export default async function SetupPage() {
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

  if (spaces && spaces.length > 0) {
    redirect("/home");
  }

  return <SpaceSetup />;
}
