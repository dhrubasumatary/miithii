"use client";

export function EmptyState({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  const suggestions = [
    { text: "Ki khobor tur?", category: "START A CHAT" },
    { text: "Mok roast kor", category: "JUST FOR FUN" },
    { text: "Khorisa r recipe de", category: "LOCAL FLAVOR" },
    { text: "Life advice de", category: "DEEP DIVE" },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 animate-fade-in">
      {/* Logo */}
      <div className="mb-10">
        <div className="w-16 h-16 rounded-2xl bg-[#30D158] flex items-center justify-center shadow-lg shadow-[#30D158]/20">
          <span className="text-black text-3xl font-bold" style={{ fontFamily: 'system-ui' }}>ম</span>
        </div>
      </div>
      
      {/* Heading */}
      <h1 className="font-serif text-3xl md:text-4xl text-[var(--text-primary)] mb-4 text-center tracking-tight">
        Ki khobor?
      </h1>
      
      {/* Subtext */}
      <p className="text-[var(--text-secondary)] text-center max-w-md mb-14 text-base leading-relaxed">
        Moi <span className="text-[#30D158]">Miithii</span>, your AI buddy from Guwahati. 
        Axomiya, English, or a mix of both—jikunu kotha patibo paru.
      </p>
      
      {/* Suggestion Cards */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-md">
        {suggestions.map((s, idx) => (
          <button
            key={s.text}
            onClick={() => onSuggestionClick(s.text)}
            className="group p-4 rounded-xl bg-white/[0.03] text-left hover:bg-white/[0.06] transition-all duration-200"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <p className="text-[15px] text-[var(--text-primary)] group-hover:text-white transition-colors mb-1.5">
              {s.text}
            </p>
            <span className="text-[10px] text-[var(--text-muted)] tracking-widest">
              {s.category}
            </span>
          </button>
        ))}
      </div>
      
      {/* Footer */}
      <p className="mt-20 text-[11px] text-[var(--text-muted)] tracking-widest uppercase">
        Built by Prompt Mafia Inc.
      </p>
    </div>
  );
}
