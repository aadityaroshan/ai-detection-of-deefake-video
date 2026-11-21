import { Menu, X } from 'lucide-react';
import { useState } from 'react';

export type AppPage = 'home' | 'detect' | 'results' | 'history' | 'about';

interface NavbarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage, scrollToSection?: string) => void;
}

export function Navbar({ currentPage, onNavigate }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLinkClick = (page: AppPage, section?: string) => {
    setMobileMenuOpen(false);
    onNavigate(page, section);
  };

  const navLinks: Array<{
    label: string;
    page: AppPage;
    section?: string;
    active: boolean;
  }> = [
    { label: 'Home', page: 'home', active: currentPage === 'home' },
    {
      label: 'Detect Media',
      page: 'detect',
      active: currentPage === 'detect' || currentPage === 'results',
    },
    {
      label: 'How It Works',
      page: 'home',
      section: 'how-it-works',
      active: false,
    },
    { label: 'History', page: 'history', active: currentPage === 'history' },
    { label: 'About', page: 'about', active: currentPage === 'about' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#050811]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-5 sm:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleLinkClick('home')}
          className="flex items-center gap-2.5 whitespace-nowrap shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-md"
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 28 28"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <path
              d="M14 2.5L24 6.8V14.2C24 19.8 19.8 24.4 14 26C8.2 24.4 4 19.8 4 14.2V6.8L14 2.5Z"
              stroke="#22D3EE"
              strokeWidth="1.75"
              fill="#0B1328"
            />
            <circle cx="14" cy="13.5" r="4.2" stroke="#60A5FA" strokeWidth="1.6" />
            <circle cx="14" cy="13.5" r="1.4" fill="#22D3EE" />
          </svg>
          <span className="font-[var(--font-display)] text-base sm:text-lg font-bold tracking-tight text-slate-50">
            AI Truth Detector
          </span>
        </button>

        {/* Zone 2: 5 Clean Single-Line Text Navigation Links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-7"
        >
          {navLinks.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleLinkClick(item.page, item.section)}
              className={`relative py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-sm ${
                item.active
                  ? 'text-cyan-300'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {item.label}
              {item.active && (
                <span className="absolute inset-x-0 -bottom-[21px] h-[2px] bg-cyan-400" />
              )}
            </button>
          ))}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleLinkClick('detect')}
            className="hidden sm:inline-flex items-center justify-center rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors duration-150 hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 whitespace-nowrap shrink-0"
          >
            Analyze Media
          </button>

          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white md:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-slate-800/80 bg-[#070C1A] px-5 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleLinkClick(item.page, item.section)}
                className={`flex min-h-[44px] items-center rounded-lg px-3 text-left text-sm font-medium transition-colors ${
                  item.active
                    ? 'bg-cyan-500/10 text-cyan-300'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleLinkClick('detect')}
              className="mt-2 flex min-h-[44px] items-center justify-center rounded-lg bg-cyan-500 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
            >
              Analyze Media
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
