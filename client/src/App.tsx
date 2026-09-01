import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { SurveyFlow } from "@/pages/SurveyFlow";
import { Landing } from "@/pages/Landing";
import { JoinSurveyFlow } from "@/pages/JoinSurveyFlow";
import { ChurchAuth } from "@/pages/ChurchAuth";
import { ChurchDashboard } from "@/pages/ChurchDashboard";
import { ChurchSettings } from "@/pages/ChurchSettings";
import { AdminOverview } from "@/pages/AdminOverview";
import { AdminLogin } from "@/pages/AdminLogin";
import { ChurchAuthProvider } from "@/lib/churchAuth";
import { AdminAuthProvider } from "@/lib/adminAuth";

function LandingRoute() {
  const [, setLocation] = useLocation();
  return <Landing onStartIndividual={() => setLocation("/survey")} />;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={LandingRoute} />
      <Route path="/survey" component={SurveyFlow} />
      <Route path="/join/:code" component={JoinSurveyFlow} />
      <Route path="/church" component={ChurchAuth} />
      <Route path="/dashboard" component={ChurchDashboard} />
      <Route path="/settings" component={ChurchSettings} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminOverview} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <ChurchAuthProvider>
          <AdminAuthProvider>
            <Router hook={useHashLocation}>
              <AppRouter />
            </Router>
          </AdminAuthProvider>
        </ChurchAuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
