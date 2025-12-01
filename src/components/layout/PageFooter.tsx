"use client";

export function PageFooter() {
  return (
    <footer className="flex-shrink-0 px-6 py-4 border-t border-white/[0.04] bg-[var(--bg-primary)]">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 rounded bg-[#30D158] flex items-center justify-center">
            <span className="text-black font-bold text-[8px]" style={{ fontFamily: 'system-ui' }}>ম</span>
          </div>
          <span className="text-[var(--text-muted)] text-xs">
            © 2025 Prompt Mafia Inc. · Made in Guwahati
          </span>
        </div>
      </div>
    </footer>
  );
}
