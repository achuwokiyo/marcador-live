import { Switch, Route, useLocation } from "wouter";
import { queryClient, getQueryFn } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

// Pages
import Landing from "@/pages/Landing";
import MatchAdmin from "@/pages/MatchAdmin";
import PublicMatch from "@/pages/PublicMatch";
import ActiveMatches from "@/pages/ActiveMatches";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import Widget from "@/pages/Widget";
import WidgetEmbed from "@/pages/WidgetEmbed";
import MatchWidget from "@/pages/MatchWidget";
import Registro from "@/pages/Registro";
import Login from "@/pages/Login";
import Recuperar from "@/pages/Recuperar";
import ClubCoordinatorPanel from "@/pages/ClubCoordinatorPanel";
import ClubDelegatePanel from "@/pages/ClubDelegatePanel";
import ClubPublicLanding from "@/pages/ClubPublicLanding";

function AdminRoute() {
  const [, setLocation] = useLocation();
  const { data, isLoading, error } = useQuery<{ isSuperAdmin: boolean } | null>({
    queryKey: ["/api/admin/check"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.isSuperAdmin) {
    setLocation("/");
    return null;
  }

  return <AdminDashboard />;
}

function Router() {
  return (
    <Switch>
      {/* Landing Page - Create Match */}
      <Route path="/" component={Landing} />
      
      {/* Signup Page (Replit Auth - legacy) */}
      <Route path="/signup" component={Signup} />
      
      {/* Local Auth Pages */}
      <Route path="/registro" component={Registro} />
      <Route path="/login" component={Login} />
      <Route path="/recuperar" component={Recuperar} />
      
      {/* Dashboard (Logged in users) */}
      <Route path="/dashboard" component={Dashboard} />
      
      {/* Super Admin Dashboard */}
      <Route path="/admin" component={AdminRoute} />
      
      {/* Active Matches View (Protected) */}
      <Route path="/directo" component={ActiveMatches} />
      
      {/* Public View */}
      <Route path="/match/:id" component={PublicMatch} />
      
      {/* Admin View */}
      <Route path="/match/:id/admin" component={MatchAdmin} />
      
      {/* Widget for embedding */}
      <Route path="/widget" component={Widget} />
      
      {/* Single match widget for embedding */}
      <Route path="/match/:id/widget" component={MatchWidget} />
      
      {/* Widget embed code page */}
      <Route path="/widget-embed" component={WidgetEmbed} />
      
      {/* Club routes */}
      <Route path="/club/:slug/admin" component={ClubCoordinatorPanel} />
      <Route path="/club/:slug/delegado" component={ClubDelegatePanel} />
      <Route path="/club/:slug" component={ClubPublicLanding} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
