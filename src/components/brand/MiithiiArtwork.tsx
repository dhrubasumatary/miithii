type MiithiiArtworkProps = {
  compact?: boolean;
};

export function MiithiiArtwork({ compact = false }: MiithiiArtworkProps) {
  if (compact) {
    return (
      <div
        style={{
          alignItems: "center",
          backgroundColor: "#30D158",
          borderRadius: 48,
          color: "#111311",
          display: "flex",
          fontFamily: "Noto Sans Bengali, Noto Sans, system-ui, sans-serif",
          fontSize: 112,
          fontWeight: 900,
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        ম
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "#f6f5ef",
        color: "#111311",
        display: "flex",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          backgroundColor: "#f6f5ef",
          display: "flex",
          height: "100%",
          position: "absolute",
          width: "100%",
        }}
      />
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 56,
          height: "100%",
          padding: "64px 76px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            backgroundColor: "#30D158",
            border: "10px solid rgba(17, 19, 17, 0.08)",
            borderRadius: 52,
            boxShadow: "0 28px 80px rgba(17, 19, 17, 0.14)",
            color: "#111311",
            display: "flex",
            flexShrink: 0,
            fontFamily: "Noto Sans Bengali, Noto Sans, system-ui, sans-serif",
            fontSize: 132,
            fontWeight: 900,
            height: 196,
            justifyContent: "center",
            width: 196,
          }}
        >
          ম
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxWidth: compact ? 520 : 780,
          }}
        >
          <div
            style={{
              color: "rgba(17, 19, 17, 0.52)",
              display: "flex",
              fontFamily: "Inter, Sora, system-ui, sans-serif",
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            Miithii Voice
          </div>
          <div
            style={{
              color: "#111311",
              display: "flex",
              fontFamily: "Inter, Sora, system-ui, sans-serif",
              fontSize: compact ? 54 : 72,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1.02,
            }}
          >
            Assamese and Northeast voiceovers in seconds.
          </div>
          <div
            style={{
              color: "rgba(17, 19, 17, 0.6)",
              display: "flex",
              fontFamily: "Inter, Sora, system-ui, sans-serif",
              fontSize: compact ? 26 : 31,
              fontWeight: 600,
              lineHeight: 1.35,
            }}
          >
            Paste script. Detect language. Download a regional voice file.
          </div>
        </div>
      </div>
    </div>
  );
}
