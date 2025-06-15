'use server';

/**
 * @fileOverview Automatically scrapes contact information for a company using GenAI tools.
 *
 * - scrapeContactInfo - A function that handles the contact information scraping process.
 * - ScrapeContactInfoInput - The input type for the scrapeContactInfo function.
 * - ScrapeContactInfoOutput - The return type for the scrapeContactInfo function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ScrapeContactInfoInputSchema = z.object({
  companyName: z.string().describe('The name of the company to scrape contact information for.'),
});
export type ScrapeContactInfoInput = z.infer<typeof ScrapeContactInfoInputSchema>;

const ScrapeContactInfoOutputSchema = z.object({
  contactInfo: z
    .string()
    .describe('The contact information for the company, including phone number, email, and address.'),
  confidenceScore: z
    .number()
    .describe('A score between 0 and 1 indicating the confidence in the accuracy of the contact information.'),
});
export type ScrapeContactInfoOutput = z.infer<typeof ScrapeContactInfoOutputSchema>;

export async function scrapeContactInfo(input: ScrapeContactInfoInput): Promise<ScrapeContactInfoOutput> {
  return scrapeContactInfoFlow(input);
}

const scrapeContactInfoTool = ai.defineTool({
  name: 'scrapeContactInfoTool',
  description: 'Scrapes the internet for contact information for a given company.',
  inputSchema: z.object({
    companyName: z.string().describe('The name of the company to scrape contact information for.'),
  }),
  outputSchema: z.string(),
  async resolve(input) {
    // Dummy implementation - replace with actual scraping logic
    return `Contact info for ${input.companyName} scraped from the internet.`;
  },
});

const prompt = ai.definePrompt({
  name: 'scrapeContactInfoPrompt',
  input: {schema: ScrapeContactInfoInputSchema},
  output: {schema: ScrapeContactInfoOutputSchema},
  tools: [scrapeContactInfoTool],
  prompt: `You are an expert at finding contact information for companies.

  Use the scrapeContactInfoTool to find contact information for the company provided by the user.  If the tool fails, indicate in the output that the contact info could not be found.

  Company Name: {{{companyName}}}

  Format your response with the contact information and a confidence score.`,
});

const scrapeContactInfoFlow = ai.defineFlow(
  {
    name: 'scrapeContactInfoFlow',
    inputSchema: ScrapeContactInfoInputSchema,
    outputSchema: ScrapeContactInfoOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    // For now, the confidence score is a constant.
    return {...output!, confidenceScore: 0.8};
  }
);
