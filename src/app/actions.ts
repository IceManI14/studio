
'use server';

import { scrapeContactInfo } from '@/ai/flows/scrape-contact-info';
import { summarizeVisitNotes } from '@/ai/flows/summarize-visit-notes';
import { getCompanyNameFromCoords } from '@/ai/flows/get-company-name-from-coords.ts';
import { chatWithVisits } from '@/ai/flows/chat-with-visits-flow.ts';
import { findOptimalParking } from '@/ai/flows/find-optimal-parking-flow.ts';
import { extractCitiesFromPdf } from '@/ai/flows/extract-cities-from-pdf-flow';
import { findPlaceFromText } from '@/services/google-places';
import type { Visit, ContactInfo, ChatMessage } from '@/lib/types';
import { z } from 'zod';
import { format } from 'date-fns';

export interface SaveVisitPayload {
  id?: string; // For updates
  companyName: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  partnershipConfidence?: number;
  hasBusinessCard?: boolean;
  businessCardImageUrl?: string | null; // Can be Data URI
  discussedCompetitors?: boolean;
  competitorName?: string;
  coolerType?: string;
  decisionMakerName?: string;
  decisionMakerTitle?: string;
  decisionMakerContact?: string;
  visitNumber?: number; 
  interestedUnit?: string; 
  hasTDSReading?: boolean;
  tdsValue?: number;
  futureMeetingSet?: boolean; 
  futureMeetingDateTime?: Date;
  freeTrial?: boolean;
  dealClosed?: boolean;
  originalCompanyName?: string;
  originalNotes?: string;
  existingContactInfo?: ContactInfo; 
  existingNotesSummary?: string;
  originalBusinessCardImageUrl?: string | null; // Can be Data URI
}

const saveVisitPayloadSchema = z.object({
  id: z.string().optional(),
  companyName: z.string().min(1, "Company name is required"),
  notes: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  partnershipConfidence: z.number().min(1).max(5).optional(),
  hasBusinessCard: z.boolean().optional(),
  businessCardImageUrl: z.string().optional().nullable(), // Accepts Data URI or other strings
  discussedCompetitors: z.boolean().optional(),
  competitorName: z.string().optional(),
  coolerType: z.string().optional(),
  decisionMakerName: z.string().optional().default(''),
  decisionMakerTitle: z.string().optional().default(''),
  decisionMakerContact: z.string().optional().default(''),
  visitNumber: z.number().optional(),
  interestedUnit: z.string().optional(),
  hasTDSReading: z.boolean().optional(),
  tdsValue: z.number().min(0, "TDS value must be 0 or greater.").max(1500, "TDS value must be 1500 or less.").optional(),
  futureMeetingSet: z.boolean().optional(),
  futureMeetingDateTime: z.date().optional(),
  freeTrial: z.boolean().optional(),
  dealClosed: z.boolean().optional(),
  originalCompanyName: z.string().optional(),
  originalNotes: z.string().optional(),
  existingContactInfo: z.object({
    info: z.string(),
    confidence: z.number(),
  }).optional(),
  existingNotesSummary: z.string().optional(),
  originalBusinessCardImageUrl: z.string().optional().nullable(),
}).refine(data => {
  if (data.hasTDSReading && (data.tdsValue === undefined || data.tdsValue === null)) {
    return false; 
  }
  return true;
}, {
  message: "TDS value is required when TDS Reading is checked.",
  path: ["tdsValue"], 
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
      } catch (e: any) {
        console.warn("Failed to scrape contact info:", e);
        const errorMessage = e?.message?.toLowerCase() || '';
        if (errorMessage.includes('api key not valid') || errorMessage.includes('permission denied') || errorMessage.includes('authentication failed')) {
            throw new Error("AI API Key is invalid. Cannot fetch contact info.");
        }
        contactDetails = { info: "No contact info found on web!", confidence: 0 };
      }
    }

    if (validatedPayload.notes && validatedPayload.notes.trim() !== '' && (isNewVisit || notesChanged || !summary)) {
      try {
        const summaryResult = await summarizeVisitNotes({ notes: validatedPayload.notes });
        summary = summaryResult.summary;
      } catch (e: any) {
        console.warn("Failed to summarize notes:", e);
        const errorMessage = e?.message?.toLowerCase() || '';
        if (errorMessage.includes('api key not valid') || errorMessage.includes('permission denied') || errorMessage.includes('authentication failed')) {
            throw new Error("AI API Key is invalid. Cannot summarize notes.");
        }
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
      businessCardImageUrl: validatedPayload.businessCardImageUrl ?? undefined, // Use Data URI from payload
      discussedCompetitors: validatedPayload.discussedCompetitors,
      competitorName: validatedPayload.competitorName,
      coolerType: validatedPayload.coolerType,
      decisionMakerName: validatedPayload.decisionMakerName,
      decisionMakerTitle: validatedPayload.decisionMakerTitle,
      decisionMakerContact: validatedPayload.decisionMakerContact,
      visitNumber: validatedPayload.visitNumber,
      interestedUnit: validatedPayload.interestedUnit,
      hasTDSReading: validatedPayload.hasTDSReading,
      tdsValue: validatedPayload.hasTDSReading ? validatedPayload.tdsValue : undefined,
      futureMeetingSet: validatedPayload.futureMeetingSet,
      futureMeetingDateTime: validatedPayload.futureMeetingSet ? validatedPayload.futureMeetingDateTime : undefined,
      freeTrial: validatedPayload.freeTrial,
      dealClosed: validatedPayload.dealClosed,
    };

    return { visit };
  } catch (error: any) {
    console.error("Error in saveVisitAction:", error);
    if (error instanceof z.ZodError) {
        return { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
    }
    const errorMessage = error?.message?.toLowerCase() || '';
    if (errorMessage.includes('api key is invalid')) {
        return { error: "Failed to save visit. The AI API key is invalid or expired. Please check your configuration." };
    }
    return { error: 'Failed to save visit. An unexpected error occurred.' };
  }
}

const getCompanyNameFromCoordsPayloadSchema = z.object({
    latitude: z.number(),
    longitude: z.number(),
});

export async function getCompanyNameFromCoordsAction(
    payload: { latitude?: number; longitude?: number; }
): Promise<{ suggestedCompanyName?: string; confidenceScore?: number; address?: string; city?: string; phone?: string; error?: string }> {
    try {
        const validatedPayload = getCompanyNameFromCoordsPayloadSchema.parse(payload);
        const result = await getCompanyNameFromCoords({
            latitude: validatedPayload.latitude,
            longitude: validatedPayload.longitude,
        });
        return { 
            suggestedCompanyName: result.suggestedCompanyName, 
            confidenceScore: result.confidenceScore,
            address: result.address,
            city: result.city,
            phone: result.phone,
        };
    } catch (error: any) {
        console.error("Error in getCompanyNameFromCoordsAction:", error);
        if (error instanceof z.ZodError) {
            return { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
        }
        const errorMessage = error?.message?.toLowerCase() || '';
        if (errorMessage.includes('api key not valid') || errorMessage.includes('permission denied') || errorMessage.includes('authentication failed')) {
            return { error: "The AI service API key is invalid or has expired. Please check your .env file." };
        }
        const userErrorMessage = error?.message ? `: ${error.message}` : '. An unexpected error occurred.';
        return { error: `Failed to suggest company name${userErrorMessage}` };
    }
}

const aiChatPayloadSchema = z.object({
  currentMessages: z.array(
    z.object({
      id: z.string(),
      sender: z.enum(['user', 'ai']),
      text: z.string(),
      timestamp: z.date(),
    })
  ),
  model: z.string(),
  visits: z.array(
    z.object({
      id: z.string(),
      timestamp: z.date(),
      companyName: z.string(),
      notesSummary: z.string().optional(),
      partnershipConfidence: z.number().optional(),
    })
  ),
  pdfUrl: z.string().optional(),
  territoryPdfUrl: z.string().optional(),
});

export async function getAiChatResponseAction(
  payload: z.infer<typeof aiChatPayloadSchema>
): Promise<{ aiResponse?: string; error?: string }> {
  try {
    const validatedPayload = aiChatPayloadSchema.parse(payload);

    const chatHistoryString = validatedPayload.currentMessages
      .map(msg => `${msg.sender === 'user' ? 'User' : 'AI'}: ${msg.text}`)
      .join('\n');
    
    const newUserMessage = validatedPayload.currentMessages[validatedPayload.currentMessages.length - 1].text;

    const visitsContextString = validatedPayload.visits
      .map(
        (visit) => {
          const confidenceText = visit.partnershipConfidence 
            ? `${visit.partnershipConfidence}/5 stars` 
            : 'Not Rated';
          return `Company: ${visit.companyName}, Visited: ${format(visit.timestamp, 'yyyy-MM-dd')}, Confidence: ${confidenceText}, Summary: ${visit.notesSummary || 'No summary available.'}`;
        }
      )
      .join('\n---\n');

    const result = await chatWithVisits({
      chatHistory: chatHistoryString,
      userMessage: newUserMessage,
      visitsContext: visitsContextString,
      modelName: validatedPayload.model,
      pdfUrl: validatedPayload.pdfUrl,
      territoryPdfUrl: validatedPayload.territoryPdfUrl,
    });

    return { aiResponse: result.aiResponse };
  } catch (error: any) {
    console.error("Error in getAiChatResponseAction:", error);
    if (error instanceof z.ZodError) {
      return { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
    }
    const errorMessage = error?.message?.toLowerCase() || '';
    if (errorMessage.includes('api key not valid') || errorMessage.includes('permission denied') || errorMessage.includes('authentication failed')) {
        return { error: `The AI service API key is invalid or has expired. Please check your .env file. (Model: ${payload.model})` };
    }
    return { error: `AI chat failed: ${error.message || 'An unexpected error occurred.'}` };
  }
}

const summarizeNotesSchema = z.object({
  notes: z.string().min(1, "Notes cannot be empty."),
});

export async function summarizeNotesAction(
  payload: z.infer<typeof summarizeNotesSchema>
): Promise<{ summary?: string; error?: string }> {
  try {
    const validatedPayload = summarizeNotesSchema.parse(payload);
    const result = await summarizeVisitNotes({ notes: validatedPayload.notes });
    return { summary: result.summary };
  } catch (error: any) {
    console.error("Error in summarizeNotesAction:", error);
    if (error instanceof z.ZodError) {
      return { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
    }
    const errorMessage = error?.message?.toLowerCase() || '';
    if (errorMessage.includes('api key not valid') || errorMessage.includes('permission denied') || errorMessage.includes('authentication failed')) {
        return { error: "The AI service API key is invalid or has expired. Please check your .env file." };
    }
    return { error: error.message || 'Failed to summarize notes. An unexpected error occurred.' };
  }
}

const findOptimalParkingSchema = z.object({
  city: z.string().min(1, "City name is required."),
});

export async function findOptimalParkingAction(
  payload: z.infer<typeof findOptimalParkingSchema>
): Promise<{ latitude?: number; longitude?: number; locationDescription?: string; error?: string }> {
  try {
    const validatedPayload = findOptimalParkingSchema.parse(payload);
    const result = await findOptimalParking({ city: validatedPayload.city });
    return {
      latitude: result.latitude,
      longitude: result.longitude,
      locationDescription: result.locationDescription,
    };
  } catch (error: any) {
    console.error("Error in findOptimalParkingAction:", error);
    if (error instanceof z.ZodError) {
      return { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
    }
    const errorMessage = error?.message?.toLowerCase() || '';
    if (errorMessage.includes('api key not valid') || errorMessage.includes('permission denied') || errorMessage.includes('authentication failed')) {
        return { error: "The AI service API key is invalid or has expired. Please check your .env file." };
    }
    return { error: error.message || 'Failed to find optimal parking location. An unexpected error occurred.' };
  }
}

const extractCitiesSchema = z.object({
  pdfDataUri: z.string().min(1, "PDF data URI is required."),
});

export async function extractCitiesFromPdfAction(
  payload: z.infer<typeof extractCitiesSchema>
): Promise<{ cities?: string[]; error?: string }> {
  try {
    const validatedPayload = extractCitiesSchema.parse(payload);
    const result = await extractCitiesFromPdf({ pdfDataUri: validatedPayload.pdfDataUri });
    return { cities: result.cities };
  } catch (error: any) {
    console.error("Error in extractCitiesFromPdfAction:", error);
    if (error instanceof z.ZodError) {
      return { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
    }
    const errorMessage = error?.message?.toLowerCase() || '';
    if (errorMessage.includes('api key not valid')) {
        return { error: "The AI service API key is invalid or has expired." };
    }
    return { error: error.message || 'Failed to extract cities from PDF. An unexpected error occurred.' };
  }
}

const findCompanySchema = z.object({
  companyName: z.string().min(1, "Company name is required."),
  city: z.string().optional(),
});

export async function findCompanyAction(
  payload: z.infer<typeof findCompanySchema>
): Promise<{ 
  place?: {
    companyName: string;
    address: string;
    city: string;
    phone: string;
    latitude?: number;
    longitude?: number;
  };
  error?: string 
}> {
  try {
    const validatedPayload = findCompanySchema.parse(payload);
    const query = `${validatedPayload.companyName}${validatedPayload.city ? `, ${validatedPayload.city}` : ''}`;
    
    const result = await findPlaceFromText(query);
    if (!result) {
      return { error: 'Company not found.' };
    }
    return { place: {
        companyName: result.suggestedCompanyName,
        address: result.address,
        city: result.city,
        phone: result.phone,
        latitude: result.latitude,
        longitude: result.longitude,
    } };
  } catch (error: any) {
    console.error("Error in findCompanyAction:", error);
    if (error instanceof z.ZodError) {
        return { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
    }
    const errorMessage = error?.message?.toLowerCase() || '';
    if (errorMessage.includes('api key')) {
        return { error: "The Google Maps API key is invalid or not configured properly. Please check your .env file." };
    }
    return { error: error.message || 'Failed to find company. An unexpected error occurred.' };
  }
}
