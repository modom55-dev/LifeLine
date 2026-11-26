import { Toaster } from "sonner";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import Workspace from "./pages/Workspace";
import Member from "./pages/Member";
import Access from "./pages/Access";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <ErrorBoundary>
      <Toaster position="bottom-right" richColors />
      <Switch>
        <Route path="/" component={Workspace} />
        <Route path="/admin" component={Workspace} />
        <Route path="/admin/:section" component={Workspace} />
        <Route path="/c/wholelife" component={Member} />
        <Route path="/access" component={Access} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}
