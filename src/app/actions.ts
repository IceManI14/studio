'use server';

import { scrapeContactInfo } from '@/ai/flows/scrape-contact-info';
import { summarizeVisitNotes } from '@/ai/flows/summarize-visit-notes';
import type { Visit, ContactInfo } from '@/lib/types';
import { z } from 'zod';

export interface SaveVisitPayload {
  id?: string; // For updates
  companyName: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  // For updates, to know if critical fields changed
  originalCompanyName?: string;
  originalNotes?: string;
  existingContactInfo?: ContactInfo; 
  existingNotesSummary?: string;
}

const saveVisitPayloadSchema = z.object({
  id: z.string().optional(),
  companyName: z.string().min(1, "Company name is required"),
  notes: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  originalCompanyName: z.string().optional(),
  originalNotes: z.string().optional(),
  existingContactInfo: z.object({
    info: z.string(),
    confidence: z.number(),
  }).optional(),
  existingNotesSummary: z.string().optional(),
});


export async function saveVisitAction(payload: SaveVisitPayload): Promise<{ visit?: Visit; error?: string }> {
  try {
    const validatedPayload = saveVisitPayloadSchema.parse(payload);
    
    let contactDetails: ContactInfo | undefined = validatedPayload.existingContactInfo;
    let summary: string | undefined = validatedPayload.existingNotesSummary;

    const isNewVisit = !validatedPayload.id;
    const companyChanged = !isNewVisit && validatedPayload.companyName !== validatedPayload.originalCompanyName;
    const notesChanged = !isNewVisit && validatedPayload.notes !== validatedPayload.originalNotes;
    
    if (isNewVisit || companyChanged || !contactDetails) {
      try {
        const contactResult = await scrapeContactInfo({ companyName: validatedPayload.companyName });
        contactDetails = {
            info: contactResult.contactInfo,
            confidence: contactResult.confidenceScore,
        };
      } catch (e) {
        console.warn("Failed to scrape contact info:", e);
        // Proceed without contact info or with partial error handling
        contactDetails = { info: "Could not retrieve contact info.", confidence: 0 };
      }
    }

    if (validatedPayload.notes && validatedPayload.notes.trim() !== '' && (isNewVisit || notesChanged || !summary)) {
      try {
        const summaryResult = await summarizeVisitNotes({ notes: validatedPayload.notes });
        summary = summaryResult.summary;
      } catch (e) {
        console.warn("Failed to summarize notes:", e);
        summary = "Could not summarize notes.";
      }
    }

    const visit: Visit = {
      id: validatedPayload.id || crypto.randomUUID(),
      timestamp: new Date(),
      companyName: validatedPayload.companyName,
      notes: validatedPayload.notes,
      latitude: validatedPayload.latitude,
      longitude: validatedPayload.longitude,
      contactInfo: contactDetails,
      notesSummary: summary,
    };

    return { visit };
  } catch (error) {
    console.error("Error in saveVisitAction:", error);
    if (error instanceof z.ZodError) {
        return { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
    }
    return { error: 'Failed to save visit. An unexpected error occurred.' };
  }
}
