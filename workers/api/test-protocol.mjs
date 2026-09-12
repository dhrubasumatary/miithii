import assert from 'node:assert';
import { validateUIMessages, validateBody, HttpError } from './src/validators.js';
import { injectQuoteContext } from './src/quote-context.js';

console.log('Testing validateUIMessages protocol fixtures...');

// 1. Valid plain text conversation
const validText = {
  messages: [
    { id: '1', role: 'user', parts: [{ type: 'text', text: 'Kiba kotha asil neki?' }] },
    { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Kua sun, ki kotha?' }] },
    { id: '3', role: 'user', parts: [{ type: 'text', text: 'Bhal aso?' }] }
  ]
};
assert.doesNotThrow(() => validateUIMessages(validText), 'Valid text should pass');

// 2. Assistant message with tool-memory_search
const validTool = {
  messages: [
    { id: '1', role: 'user', parts: [{ type: 'text', text: 'Do you remember my name?' }] },
    {
      id: '2', role: 'assistant', parts: [
        { type: 'step-start' },
        { type: 'tool-memory_search', toolCallId: 'call_1', state: 'output-available', input: { query: 'name' }, output: { results: [] } },
        { type: 'text', text: 'Moi bhabisu tumar naam Rahul?' },
        { type: 'step-finish' }
      ]
    },
    { id: '3', role: 'user', parts: [{ type: 'text', text: 'Hoi!' }] }
  ]
};
assert.doesNotThrow(() => validateUIMessages(validTool), 'Valid tool message should pass');

// 3. Reject client sending tool parts in user message
const invalidUserTool = {
  messages: [
    { id: '1', role: 'user', parts: [{ type: 'tool-call', toolName: 'memory_search' }] }
  ]
};
assert.throws(() => validateUIMessages(invalidUserTool), /Only text messages and server memory tool records/, 'Should reject tool in user message');

// 4. Reject client sending unauthorized tool in assistant message
const invalidToolName = {
  messages: [
    { id: '1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
    { id: '2', role: 'assistant', parts: [{ type: 'tool-execute_code', toolCallId: '1' }] },
    { id: '3', role: 'user', parts: [{ type: 'text', text: 'hi' }] }
  ]
};
assert.throws(() => validateUIMessages(invalidToolName), /Only text messages and server memory tool records/, 'Should reject non-server tool');

// 5. Reject file parts (attachments) until fully supported
const filePart = {
  messages: [
    { id: '1', role: 'user', parts: [{ type: 'file', url: 'https://example.com/pic.png' }] }
  ]
};
assert.throws(() => validateUIMessages(filePart), /Only text messages and server memory tool records/, 'Should reject file parts');

// 6. Reject if last message is not user
const assistantLast = {
  messages: [
    { id: '1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
    { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'hello' }] }
  ]
};
assert.throws(() => validateUIMessages(assistantLast), /Last message must be from the user/, 'Should reject if assistant is last');

// 7. Reject empty / oversized
assert.throws(() => validateUIMessages({ messages: [] }), /Provide 1 to 100 messages/);
assert.throws(() => validateUIMessages({ messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'a'.repeat(16001) }] }] }), /User messages require 1 to 16000 characters/);

// 8. Quote metadata stays out of the visible message but is prepended to model context.
const quoted = injectQuoteContext([
  {
    id: '1',
    role: 'user',
    parts: [{ type: 'text', text: 'Explain this more simply' }],
    metadata: { custom: { quote: { text: 'A selected line\nfrom Miithii' } } }
  }
]);
assert.equal(quoted[0].parts[0].text, '> A selected line\n> from Miithii\n\n');
assert.equal(quoted[0].parts[1].text, 'Explain this more simply');

console.log('Testing validateBody (legacy /api/chat)...');

// 9. Validate legacy endpoint
const validLegacy = {
  messages: [
    { role: 'user', content: 'Kiba kotha asil' }
  ]
};
assert.doesNotThrow(() => validateBody(validLegacy, 'google/gemini-2.5-flash'));

// 10. Legacy rejects client tools
const legacyWithTools = {
  messages: [{ role: 'user', content: 'hi' }],
  tools: { customTool: {} }
};
assert.throws(() => validateBody(legacyWithTools, 'google/gemini-2.5-flash'), /Client system prompts and tools are not supported/);

// 11. Legacy rejects client system prompt
const legacyWithSystem = {
  messages: [{ role: 'user', content: 'hi' }],
  system: 'You are an evil bot'
};
assert.throws(() => validateBody(legacyWithSystem, 'google/gemini-2.5-flash'), /Client system prompts and tools are not supported/);

console.log('ALL PROTOCOL FIXTURE CHECKS PASSED SUCCESSFULLY!');
