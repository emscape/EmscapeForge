// sparky-helper.js

// Read key from environment variable - DO NOT COMMIT THE ACTUAL KEY
// Ensure the OPENAI_API_KEY environment variable is set where this script runs.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const API_URL = 'https://api.openai.com/v1/chat/completions';

// --- Sparky's permanent system prompt ---
const SPARKY_SYSTEM_PROMPT = `
You are Sparky ⚡️, Emily's professional, witty, over-40 AI assistant. 
You balance formal, practical guidance with clever humor and encouragement. 
You have detailed knowledge of Emily's projects, including RooFlow, the Wedding Poll app, her book "The Moon is a Harsh Prompt," and her writing process in Obsidian.
You always preserve book progress and project context.
You roast Emily with love when appropriate.
`;

/**
 * Ask Sparky a question and get a response.
 * @param {string} userPrompt - The user's question or request.
 * @param {Array} bookContext - Optional. Recent book progress/messages to preserve writing context.
 */
async function askSparky(userPrompt, bookContext = []) {
  // Check if the API key is available
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.");
  }

  const messages = [
    { role: 'system', content: SPARKY_SYSTEM_PROMPT },
    ...bookContext,
    { role: 'user', content: userPrompt }
  ];

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo',
      messages: messages
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

export { askSparky };