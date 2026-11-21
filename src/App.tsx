/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useState } from 'react';
import { AboutPage } from './components/AboutPage';
import { DetectPage } from './components/DetectPage';
import { HistoryPage } from './components/HistoryPage';
import { HomePage } from './components/HomePage';
import { type AppPage, Navbar } from './components/Navbar';
import { ResultsPage } from './components/ResultsPage';
import type { AnalysisReport } from './types/forensics';

export default function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>('home');
  const [activeReport, setActiveReport] = useState<AnalysisReport | null>(null);

  const handleNavigate = useCallback(
    (page: AppPage, scrollToSection?: string) => {
      if (page === 'results' && !activeReport) {
        setCurrentPage('detect');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      setCurrentPage(page);

      if (scrollToSection) {
        window.setTimeout(() => {
          const el = document.getElementById(scrollToSection);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 60);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [activeReport]
  );

  const handleOpenReport = useCallback((report: AnalysisReport) => {
    setActiveReport(report);
    setCurrentPage('results');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col bg-[#050811] text-slate-100">
      {/* Subtle atmospheric top-edge obsidian-cobalt lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_75%_50%_at_50%_-10%,rgba(6,182,212,0.12),rgba(59,130,246,0.05)_45%,transparent_80%)]"
      />

      <Navbar currentPage={currentPage} onNavigate={handleNavigate} />

      <main className="flex-1">
        {currentPage === 'home' && <HomePage onNavigate={handleNavigate} />}
        {currentPage === 'detect' && (
          <DetectPage onAnalysisComplete={handleOpenReport} />
        )}
        {currentPage === 'results' && activeReport && (
          <ResultsPage report={activeReport} onNavigate={handleNavigate} />
        )}
        {currentPage === 'history' && (
          <HistoryPage
            onOpenReport={handleOpenReport}
            onNavigate={handleNavigate}
          />
        )}
        {currentPage === 'about' && <AboutPage onNavigate={handleNavigate} />}
      </main>

      <footer className="border-t border-slate-800/80 bg-[#04070F]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-5 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-slate-300">
              AI Truth Detector
            </span>
            <span aria-hidden="true">·</span>
            <span>Discover What&apos;s Real. Detect What&apos;s AI.</span>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => handleNavigate('detect')}
              className="hover:text-slate-300 transition-colors"
            >
              Detect Media
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('history')}
              className="hover:text-slate-300 transition-colors"
            >
              History
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('about')}
              className="hover:text-slate-300 transition-colors"
            >
              Methodology &amp; Limitations
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
