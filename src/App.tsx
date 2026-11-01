import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { backendConfigured } from './lib/supabase';
import { AuthProvider, useAuth } from './state/auth';
import { Layout } from './ui/Layout';
import { Spinner, ToastProvider } from './ui/kit';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Battle = lazy(() => import('./pages/Battle'));
const Room = lazy(() => import('./pages/Room'));
const MatchPage = lazy(() => import('./pages/Match'));
const PracticePlay = lazy(() => import('./pages/PracticePlay'));
const Collection = lazy(() => import('./pages/Collection'));
const Decks = lazy(() => import('./pages/Decks'));
const DeckEditor = lazy(() => import('./pages/DeckEditor'));
const Shop = lazy(() => import('./pages/Shop'));
const Profile = lazy(() => import('./pages/Profile'));

/** Pages that need an account redirect to login (or explain offline mode). */
function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, session } = useAuth();
  if (!backendConfigured) return <Navigate to="/login" replace />;
  if (!ready) return <Spinner label="Loading your parlor…" />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/battle" element={<Battle />} />
                <Route path="/room/:id" element={<RequireAuth><Room /></RequireAuth>} />
                <Route path="/match/:id" element={<RequireAuth><MatchPage /></RequireAuth>} />
                <Route path="/practice/play" element={<PracticePlay />} />
                <Route path="/collection" element={<Collection />} />
                <Route path="/decks" element={<RequireAuth><Decks /></RequireAuth>} />
                <Route path="/decks/:id" element={<RequireAuth><DeckEditor /></RequireAuth>} />
                <Route path="/shop" element={<RequireAuth><Shop /></RequireAuth>} />
                <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
