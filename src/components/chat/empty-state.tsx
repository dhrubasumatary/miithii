"use client";

export function EmptyState({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  const suggestions = [
    { text: "15% of 847 ki hobo?", icon: "🧮", category: "Math" },
    { text: "Mok roast kor", icon: "🔥", category: "Fun" },
    { text: "Recipe likhi diya", icon: "🍛", category: "Help" },
    { text: "Code debug kor", icon: "💻", category: "Tech" },
  ];

  const features = ["Image Analysis", "Calculator", "Code Help", "Roast Mode"];

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] px-4 animate-fade-in">
      {/* Animated Logo with Glow */}
      <div className="relative mb-8">
        <div className="absolute inset-0 w-20 h-20 rounded-3xl bg-[#30D158] blur-2xl opacity-40 animate-pulse" />
        <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-[#30D158] to-[#1A9B4B] flex items-center justify-center shadow-[0_0_60px_rgba(48,209,88,0.25)]">
          <span className="text-black font-mono font-bold text-3xl select-none">म</span>
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#30D158] flex items-center justify-center animate-pulse-green">
          <span className="text-black text-[10px]">✓</span>
        </div>
      </div>
      
      {/* Greeting with Assamese Flavor */}
      <h1 className="text-3xl font-bold text-[#EDEDED] mb-2 tracking-tight">
        Namaskar! <span className="inline-block animate-wave">🙏</span>
      </h1>
      <p className="text-white/50 text-center max-w-sm mb-3 leading-relaxed">
        Moi <span className="text-[#30D158] font-medium">Miithii</span>, tur AI buddy from Guwahati.
      </p>
      <p className="text-white/30 text-sm text-center max-w-xs mb-8">
        Assamese, English, or mix both — muk hudhibi, moi dim! 
      </p>
      
      {/* Feature Pills */}
      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {features.map((f) => (
          <span 
            key={f} 
            className="px-3 py-1.5 text-[11px] rounded-full bg-white/[0.03] text-white/40 border border-white/[0.06] font-medium tracking-wide"
          >
            {f}
          </span>
        ))}
      </div>
      
      {/* Suggestion Cards Grid */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {suggestions.map((s, idx) => (
          <button
            key={s.text}
            onClick={() => onSuggestionClick(s.text)}
            className="group relative p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] text-left hover:border-[#30D158]/40 hover:bg-[#30D158]/[0.03] transition-all duration-300 overflow-hidden"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            {/* Hover glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#30D158]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <span className="relative text-2xl mb-3 block transform group-hover:scale-110 transition-transform duration-200">{s.icon}</span>
            <p className="relative text-sm text-white/60 group-hover:text-white/90 transition-colors leading-snug mb-1">{s.text}</p>
            <span className="relative text-[10px] text-white/25 uppercase tracking-wider font-medium">{s.category}</span>
          </button>
        ))}
      </div>
      
      {/* Subtle Brand Footer */}
      <p className="mt-12 text-[10px] text-white/15 tracking-widest uppercase">
        Built by Prompt Mafia Inc.
      </p>
    </div>
  );
}

