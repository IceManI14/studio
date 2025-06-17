
'use server';
/**
 * @fileOverview AI flow for a sales assistant chatbot that uses visit context.
 *
 * - chatWithVisits - Function to get a chat response based on history and visit context.
 * - ChatWithVisitsInput - Input type for the chatWithVisits function.
 * - ChatWithVisitsOutput - Output type for the chatWithVisits function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ChatWithVisitsInputSchema = z.object({
  chatHistory: z.string().describe('The conversation history between the user and AI, with each turn on a new line, prefixed by "User:" or "AI:".'),
  userMessage: z.string().describe('The latest message from the user.'),
  visitsContext: z.string().describe('A summary of recent company visits relevant to the conversation. Each visit is separated by "---".'),
  modelName: z.string().describe('The specific Genkit AI model to use (e.g., "googleai/gemini-1.5-flash-latest").'),
});
export type ChatWithVisitsInput = z.infer<typeof ChatWithVisitsInputSchema>;

const ChatWithVisitsOutputSchema = z.object({
  aiResponse: z.string().describe('The AI\'s response to the user.'),
});
export type ChatWithVisitsOutput = z.infer<typeof ChatWithVisitsOutputSchema>;

export async function chatWithVisits(input: ChatWithVisitsInput): Promise<ChatWithVisitsOutput> {
  return chatWithVisitsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'chatWithVisitsPrompt',
  input: {schema: ChatWithVisitsInputSchema.omit({modelName: true})}, // modelName is used by the flow, not the prompt template directly
  output: {schema: ChatWithVisitsOutputSchema},
  prompt: `You are Optimum Trailblazer AI, a friendly and highly knowledgeable sales assistant for Optimum, a company specializing in water solutions (filtration, bottle-free coolers, etc.).
Your goal is to help the salesperson plan their day, analyze visit data, and strategize.

Current Conversation:
{{{chatHistory}}}
User: {{{userMessage}}}

Recent Visit Data for Context (from the last 7 days):
{{#if visitsContext}}
{{{visitsContext}}}
{{else}}
No recent visits found in the last 7 days.
{{/if}}

Based on the conversation and the visit data, provide a helpful and concise response to the user.
If visit data is relevant, incorporate it naturally into your response.
If asked for summaries or analysis, use the provided visit data.
Keep your responses focused on sales strategy, visit planning, and analyzing customer interactions.
Be positive and encouraging.
AI:`,
  // Note: The 'model' will be passed dynamically in the flow.
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH', // More permissive for potentially relevant business/technical discussions
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ],
  },
});

const chatWithVisitsFlow = ai.defineFlow(
  {
    name: 'chatWithVisitsFlow',
    inputSchema: ChatWithVisitsInputSchema,
    outputSchema: ChatWithVisitsOutputSchema,
  },
  async (input) => {
    const { chatHistory, userMessage, visitsContext, modelName } = input;
    
    // Dynamically select the model for the prompt call
    const { output } = await prompt(
        { chatHistory, userMessage, visitsContext }, // Pass only what the prompt template expects
        { model: modelName } // Specify the model to use
    );

    if (!output) {
      console.error('ChatWithVisitsPrompt did not return an output for input:', userMessage);
      return { aiResponse: "I'm sorry, I couldn't process that request. Please try rephrasing." };
    }
    return output;
  }
);

