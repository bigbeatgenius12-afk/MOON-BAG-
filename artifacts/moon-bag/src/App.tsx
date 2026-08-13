import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Layout } from '@/components/layout';

// Page Imports
import MarketPage from '@/pages/market';
import CoinDetailPage from '@/pages/coin-detail';
import LaunchPage from '@/pages/launch';
import LaunchedFeedPage from '@/pages/launched-feed';
import LaunchedDetailPage from '@/pages/launched-detail';
import PortfolioPage from '@/pages/portfolio';
import BoboPage from '@/pages/bobo';
import { spotlightActive } from '@/lib/spotlight';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function NotFound() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center font-mono">
      <h1 className="text-6xl font-bold text-primary mb-4 drop-shadow-[0_0_10px_rgba(0,255,0,0.5)]">404</h1>
      <p className="text-xl text-muted-foreground mb-8 uppercase tracking-widest">Signal Lost in Space</p>
      <a href="/" className="text-primary hover:underline border border-primary px-6 py-2 uppercase font-bold tracking-wider hover:bg-primary/10 transition-colors">
        Return to Base
      </a>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={spotlightActive ? LaunchedFeedPage : MarketPage} />
      <Route path="/coin/:coinId" component={CoinDetailPage} />
      <Route path="/launch" component={LaunchPage} />
      <Route path="/launched" component={LaunchedFeedPage} />
      <Route path="/launched/:id" component={LaunchedDetailPage} />
      <Route path="/portfolio" component={PortfolioPage} />
      <Route path="/bobo" component={BoboPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Layout>
          <Router />
        </Layout>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
