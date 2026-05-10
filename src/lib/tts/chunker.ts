export function chunkTextForTts(text: string, maxChunkChars: number): string[] {
  const clean = text.trim();
  if (clean.length <= maxChunkChars) return [clean];

  const chunks: string[] = [];
  const paragraphs = clean.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);
  let current = "";

  const push = () => { if (current.trim()) chunks.push(current.trim()); current = ""; };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChunkChars) {
      const sentences = paragraph.split(/(?<=[।.!?])\s+/g);
      for (const s of sentences) {
        if ((current + "\n" + s).trim().length <= maxChunkChars) current = (current ? `${current}\n${s}` : s);
        else {
          push();
          if (s.length <= maxChunkChars) current = s;
          else {
            for (let i = 0; i < s.length; i += maxChunkChars) chunks.push(s.slice(i, i + maxChunkChars));
          }
        }
      }
      continue;
    }

    if ((current + "\n\n" + paragraph).trim().length <= maxChunkChars) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    } else {
      push();
      current = paragraph;
    }
  }

  push();
  return chunks;
}
