// File: src/App.jsx
// Routing for the hub. Pages are lazy-loaded; Settings is a modal route that
// opens on top of whichever page the user was on.
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProvider } from './context/AppContext';
import ProtectedRoute from './auth/ProtectedRoute';
import MainLayout from './components/MainLayout';
import { PageSpinner } from './components/ui/Spinner';

const LoginPage = lazy(() => import('./auth/LoginPage'));
const RegisterPage = lazy(() => import('./auth/RegisterPage'));
const Onboarding = lazy(() => import('./Onboarding/Onboarding'));
const Home = lazy(() => import('./Home/Home'));
const Dictionary = lazy(() => import('./Dictionary/Dictionary'));
const Snippets = lazy(() => import('./Snippets/Snippets'));
const Style = lazy(() => import('./Style/Style'));
const Transforms = lazy(() => import('./Transforms/Transforms'));
const SettingsModal = lazy(() => import('./Settings/SettingsModal'));

function AppRoutes() {
  const location = useLocation();
  // Set when Settings was opened from another page: keep that page rendered.
  const background = location.state?.background;

  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes location={background || location}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute requireOnboarding>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Home />} />
          <Route path="dictionary" element={<Dictionary />} />
          <Route path="snippets" element={<Snippets />} />
          <Route path="style" element={<Style />} />
          <Route path="transforms" element={<Transforms />} />
          {/* Direct link to settings: show Home underneath. */}
          <Route
            path="settings/:section?"
            element={
              <>
                <Home />
                <SettingsModal />
              </>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {background && (
        <Routes>
          <Route path="/settings/:section?" element={<SettingsModal />} />
        </Routes>
      )}
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Toaster
          position="bottom-center"
          toastOptions={{
            duration: 3500,
            className: '!rounded-xl !bg-vast-950 !text-sand-50 !text-sm !shadow-pop',
          }}
        />
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}
