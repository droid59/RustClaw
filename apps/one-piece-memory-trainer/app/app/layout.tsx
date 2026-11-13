import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/workspace";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = { title: "Trainer" };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
