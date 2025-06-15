
'use server';

import { scrapeContactInfo } from '@/ai/flows/scrape-contact-info';
import { summarizeVisitNotes } from '@/ai/flows/summarize-visit-notes';
import { getCompanyNameFromCoords } from '@/ai/flows/get-company-name-from-coords';
import type { Visit, ContactInfo } from '@/lib/types';
import { z } from 'zod';

export interface SaveVisitPayload {
  id?: string; // For updates
  companyName: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  partnershipConfidence?: number;
  hasBusinessCard?: boolean;
  discussedCompetitors?: boolean;
  competitorName?: string;
  coolerType?: string;
  decisionMakerName?: string;
  decisionMakerTitle?: string;
  decisionMakerContact?: string;
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
  partnershipConfidence: z.number().min(1).max(5).optional(),
  hasBusinessCard: z.boolean().optional(),
  discussedCompetitors: z.boolean().optional(),
  competitorName: z.string().optional(),
  coolerType: z.string().optional(),
  decisionMakerName: z.string().optional().default(''),
  decisionMakerTitle: z.string().optional().default(''),
  decisionMakerContact: z.string().optional().default(''),
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
      partnershipConfidence: validatedPayload.partnershipConfidence,
      hasBusinessCard: validatedPayload.hasBusinessCard,
      discussedCompetitors: validatedPayload.discussedCompetitors,
      competitorName: validatedPayload.competitorName,
      coolerType: validatedPayload.coolerType,
      decisionMakerName: validatedPayload.decisionMakerName,
      decisionMakerTitle: validatedPayload.decisionMakerTitle,
      decisionMakerContact: validatedPayload.decisionMakerContact,
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

const getCompanyNameFromCoordsPayloadSchema = z.object({
    latitude: z.number(),
    longitude: z.number(),
});

export async function getCompanyNameFromCoordsAction(
    payload: { latitude?: number; longitude?: number }
): Promise<{ suggestedCompanyName?: string; confidenceScore?: number; error?: string }> {
    try {
        const validatedPayload = getCompanyNameFromCoordsPayloadSchema.parse(payload);
        const result = await getCompanyNameFromCoords({
            latitude: validatedPayload.latitude,
            longitude: validatedPayload.longitude,
        });
        return { 
            suggestedCompanyName: result.suggestedCompanyName, 
            confidenceScore: result.confidenceScore 
        };
    } catch (error) {
        console.error("Error in getCompanyNameFromCoordsAction:", error);
        if (error instanceof z.ZodError) {
            return { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
        }
        return { error: 'Failed to suggest company name. An unexpected error occurred.' };
    }
}
