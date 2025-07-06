'use server';
/**
 * @fileOverview A Genkit tool for reading content from a Dropbox shared link.
 *
 * - readFromDropboxLinkTool - A tool that fetches and returns the text content of a file from Dropbox.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const readFromDropboxLinkTool = ai.defineTool(
  {
    name: 'readFromDropboxLink',
    description: 'Reads the content of a file from a Dropbox shared link. This works for text-based files (.txt, .csv, .md) and can provide basic information for other file types.',
    inputSchema: z.object({
      url: z.string().describe('The Dropbox shared link to the file.'),
    }),
    outputSchema: z.string().describe('The text content of the file, or a status message if the file is not text-based.'),
  },
  async ({ url }) => {
    try {
      // Basic check if the input string looks like a URL before attempting to parse it.
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return 'Error: The provided text does not appear to be a valid URL.';
      }

      const downloadUrl = new URL(url);
      if (downloadUrl.hostname !== 'www.dropbox.com' && downloadUrl.hostname !== 'dropbox.com') {
        return 'Error: The provided URL is not a valid Dropbox link.';
      }
      
      // Transform the URL for direct content access
      downloadUrl.hostname = 'dl.dropboxusercontent.com';
      downloadUrl.searchParams.delete('dl');
      downloadUrl.searchParams.delete('rlkey');

      const directUrl = downloadUrl.toString();

      const response = await fetch(directUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file from Dropbox: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('text') || contentType.includes('csv') || contentType.includes('json')) {
        const textContent = await response.text();
        // Return a snippet to avoid overwhelming the context window
        if (textContent.length > 20000) {
            return "File content is too long to process in one go. Please ask for specific information from the file.";
        }
        return textContent;
      }
      
      return `Successfully connected to the file at the Dropbox link. It appears to be a binary file of type '${contentType}'. I cannot display its content directly, but I can confirm it is accessible. For PDF analysis, please use the "Attach File" button.`;

    } catch (error: any) {
      console.error('Error reading from Dropbox link:', error);
      // The new URL() constructor might throw if the string isn't a valid URL.
      if (error instanceof TypeError && error.message.includes('Invalid URL')) {
          return `Error: The provided link "${url}" is not a valid URL format.`
      }
      return `Error reading file from link: ${error.message}`;
    }
  }
);
