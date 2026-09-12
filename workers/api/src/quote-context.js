const MAX_QUOTE_CHARS = 4000;

const getQuoteText = metadata => {
  if (!metadata || typeof metadata !== 'object') return '';
  const custom = metadata.custom;
  if (!custom || typeof custom !== 'object') return '';
  const quote = custom.quote;
  if (!quote || typeof quote !== 'object') return '';
  return typeof quote.text === 'string' ? quote.text.trim().slice(0, MAX_QUOTE_CHARS) : '';
};

// Mirrors assistant-ui's injectQuoteContext contract, with a server-side
// length cap so client metadata can never expand model context without bound.
export function injectQuoteContext(messages) {
  return messages.map(message => {
    if (message.role !== 'user') return message;
    const text = getQuoteText(message.metadata);
    if (!text) return message;

    const blockquote = text
      .split(/\r?\n/)
      .map(line => `> ${line}`)
      .join('\n');

    const alreadyInjected =
      message.parts?.[0]?.type === 'text' &&
      message.parts[0].text === `${blockquote}\n\n`;
    if (alreadyInjected) return message;

    return {
      ...message,
      parts: [
        { type: 'text', text: `${blockquote}\n\n` },
        ...(message.parts ?? [])
      ]
    };
  });
}
