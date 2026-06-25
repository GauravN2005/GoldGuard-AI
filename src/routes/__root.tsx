import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Command } from "cmdk";
import { Search } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppSidebar, MobileNav } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-display text-7xl">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-foreground/55">The vault drawer you're looking for is empty.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-xl bg-[color:var(--gold)] px-5 py-2.5 text-sm font-semibold text-white">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-foreground/55">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-xl bg-[color:var(--gold)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "GoldGuard AI — Gold Loan Inspection & Fraud Prevention" },
      { name: "description", content: "Premium banking-grade platform for gold loan jewelry inspection, risk analysis, and fraud prevention." },
      { name: "author", content: "GoldGuard AI" },
      { property: "og:title", content: "GoldGuard AI" },
      { property: "og:description", content: "Gold loan inspection & fraud prevention platform." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleNav = (to: string) => {
    setOpen(false);
    nav({ to });
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="relative min-h-screen">
        <div className="aurora-bg" />
        <AppSidebar />
        <MobileNav />
        <main className="relative z-10 lg:ml-[296px] px-4 lg:px-8 py-6 lg:py-8 pb-24 lg:pb-8 max-w-[1500px]">
          <Outlet />
        </main>
        <Toaster position="top-right" richColors />

        {/* Ctrl+K Command Palette */}
        <Command.Dialog
          open={open}
          onOpenChange={setOpen}
          label="Global Command Menu"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/15 backdrop-blur-sm animate-fade-in pointer-events-auto"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl glass-strong border border-white/60 shadow-2xl animate-scale-in">
            <div className="flex items-center gap-2 border-b border-black/5 px-4 h-12">
              <Search className="size-4 text-foreground/45 shrink-0" />
              <Command.Input
                placeholder="Search pages or operations..."
                className="w-full bg-transparent border-0 text-sm focus:outline-none placeholder:text-foreground/40 text-foreground"
              />
              <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-black/10 bg-black/5 px-1.5 font-mono text-[9px] font-medium text-foreground/50 opacity-100">Esc</kbd>
            </div>
            <Command.List className="max-h-[340px] overflow-y-auto p-2 space-y-1">
              <Command.Empty className="text-xs text-foreground/50 p-4 text-center">No results found.</Command.Empty>
              
              <Command.Group heading="Operations" className="text-[9px] font-bold uppercase tracking-widest text-foreground/35 px-3 py-1.5">
                <CommandItem onSelect={() => handleNav("/")}>Dashboard Overview</CommandItem>
                <CommandItem onSelect={() => handleNav("/inspection/new")}>New Appraisal/Inspection</CommandItem>
                <CommandItem onSelect={() => handleNav("/history")}>Inspection Logs & History</CommandItem>
                <CommandItem onSelect={() => handleNav("/escalations")}>Fraud Escalations Kanban</CommandItem>
                <CommandItem onSelect={() => handleNav("/investigations")}>Investigations Workspace</CommandItem>
              </Command.Group>

              <Command.Group heading="Insights & Intelligence" className="text-[9px] font-bold uppercase tracking-widest text-foreground/35 px-3 py-1.5 mt-2">
                <CommandItem onSelect={() => handleNav("/analytics")}>Analytics Center</CommandItem>
                <CommandItem onSelect={() => handleNav("/fraud-intelligence")}>Fraud Intelligence Center</CommandItem>
                <CommandItem onSelect={() => handleNav("/reports")}>Reports Center</CommandItem>
              </Command.Group>

              <Command.Group heading="Management" className="text-[9px] font-bold uppercase tracking-widest text-foreground/35 px-3 py-1.5 mt-2">
                <CommandItem onSelect={() => handleNav("/manager")}>Manager Command Center</CommandItem>
                <CommandItem onSelect={() => handleNav("/executive-dashboard")}>Executive Command Center</CommandItem>
                <CommandItem onSelect={() => handleNav("/branches")}>Multi-Branch Monitoring</CommandItem>
                <CommandItem onSelect={() => handleNav("/employees")}>Appraisers Leaderboard</CommandItem>
                <CommandItem onSelect={() => handleNav("/portfolio")}>Gold Inventory Portfolio</CommandItem>
                <CommandItem onSelect={() => handleNav("/customers")}>Customers Portfolio Database</CommandItem>
              </Command.Group>

              <Command.Group heading="Account" className="text-[9px] font-bold uppercase tracking-widest text-foreground/35 px-3 py-1.5 mt-2">
                <CommandItem onSelect={() => handleNav("/profile")}>Appraiser Profile Settings</CommandItem>
                <CommandItem onSelect={() => handleNav("/settings")}>Terminal Configuration</CommandItem>
              </Command.Group>
            </Command.List>
          </div>
        </Command.Dialog>
      </div>
    </QueryClientProvider>
  );
}

function CommandItem({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center px-3 py-2 rounded-xl text-sm text-foreground/80 cursor-pointer hover:bg-[color:var(--gold)]/10 hover:text-[color:var(--gold)] aria-selected:bg-[color:var(--gold)]/12 aria-selected:text-[color:var(--gold)] aria-selected:font-semibold transition-all select-none"
    >
      {children}
    </Command.Item>
  );
}

