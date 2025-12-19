/**
 * Developer Usage Dashboard - E12.3
 * Protected superadmin-only page.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSuperadmin } from "@/lib/auth/org-context";
import { DashboardContent } from "./dashboard-content";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Usage Dashboard | Manda Dev",
  description: "Developer usage metrics and cost tracking",
};

export default async function UsageDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Use existing isSuperadmin helper from lib/auth/org-context.ts
  if (!(await isSuperadmin(user.id))) {
    redirect("/projects");
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Usage Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor LLM costs, feature usage, and error rates across the platform.
        </p>
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[348px] rounded-lg" />
        <Skeleton className="h-[348px] rounded-lg" />
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}
