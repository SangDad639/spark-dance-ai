import { Link, useLocation } from 'react-router-dom';
import { Sparkles, Settings, History, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-secondary to-accent">
      <nav className="border-b border-white/10 bg-white/5 backdrop-blur-lg">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-white font-bold text-xl">
              <Sparkles className="w-6 h-6" />
              AI Dance Video
            </Link>
            <div className="flex gap-2">
              <Button
                variant={isActive('/') ? 'secondary' : 'ghost'}
                asChild
                className="text-white hover:bg-white/10"
              >
                <Link to="/">
                  <Home className="w-4 h-4 mr-2" />
                  Home
                </Link>
              </Button>
              <Button
                variant={isActive('/history') ? 'secondary' : 'ghost'}
                asChild
                className="text-white hover:bg-white/10"
              >
                <Link to="/history">
                  <History className="w-4 h-4 mr-2" />
                  History
                </Link>
              </Button>
              <Button
                variant={isActive('/settings') ? 'secondary' : 'ghost'}
                asChild
                className="text-white hover:bg-white/10"
              >
                <Link to="/settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};
