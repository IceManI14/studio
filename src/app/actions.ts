
'use server';

import { scrapeContactInfo } from '@/ai/flows/scrape-contact-info';
import { summarizeVisitNotes } from '@/ai/flows/summarize-visit-notes';
import { getCompanyNameFromCoords } from '@/ai/flows/get-company-name-from-coords.ts';
import { chatWithVisits } from '@/ai/flows/chat-with-visits-flow.ts';
import { findOptimalParking } from '@/ai/flows/find-optimal-parking-flow.ts';
import { extractCitiesFromPdf } from '@/ai/flows/extract-cities-from-pdf-flow';
import { findPlacesFromText } from '@/services/google-places';
import type { Visit, ContactInfo, ChatMessage, ManagedFile } from '@/lib/types';
import { z } from 'zod';
import { format } from 'date-fns';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

export interface SaveVisitPayload {
  id?: string; // For updates
  timestamp?: Date; // For updates, to preserve original timestamp
  companyName: string;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  partnershipConfidence?: number | null;
  hasBusinessCard?: boolean;
  businessCardImageUrl?: string | null; // Can be Data URI
  discussedCompetitors?: boolean;
  competitorName?: string | null;
  coolerType?: string | null;
  decisionMakerName?: string | null;
  decisionMakerTitle?: string | null;
  decisionMakerContact?: string | null;
  visitNumber?: number | null;
  interestedUnit?: string | null;
  hasTDSReading?: boolean;
  tdsValue?: number | null;
  futureMeetingSet?: boolean;
  futureMeetingDateTime?: Date | null;
  freeTrial?: boolean;
  dealClosed?: boolean;
  originalCompanyName?: string | null;
  originalNotes?: string | null;
  existingContactInfo?: ContactInfo | null;
  existingNotesSummary?: string | null;
  originalBusinessCardImageUrl?: string | null; // Can be Data URI
}

const saveVisitPayloadSchema = z.object({
  id: z.string().optional(),
  timestamp: z.coerce.date().optional(),
  companyName: z.string().min(1, "Company name is required"),
  notes: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  partnershipConfidence: z.number().min(1).max(5).optional().nullable(),
  hasBusinessCard: z.boolean().optional(),
  businessCardImageUrl: z.string().optional().nullable(),
  discussedCompetitors: z.boolean().optional(),
  competitorName: z.string().optional().nullable(),
  coolerType: z.string().optional().nullable(),
  decisionMakerName: z.string().optional().nullable().default(''),
  decisionMakerTitle: z.string().optional().nullable().default(''),
  decisionMakerContact: z.string().optional().nullable().default(''),
  visitNumber: z.number().optional().nullable(),
  interestedUnit: z.string().optional().nullable(),
  hasTDSReading: z.boolean().optional(),
  tdsValue: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
    z.number().min(0, "TDS value must be 0 or greater.").max(1500, "TDS value must be 1500 or less.").nullable().optional()
  ),
  futureMeetingSet: z.boolean().optional(),
  futureMeetingDateTime: z.preprocess(
    (val) => (val ? new Date(val as string | number | Date) : null),
    z.date().nullable().optional()
  ),
  freeTrial: z.boolean().optional(),
  dealClosed: z.boolean().optional().nullable(),
  originalCompanyName: z.string().optional().nullable(),
  originalNotes: z.string().optional().nullable(),
  existingContactInfo: z.object({
    info: z.string(),
    confidence: z.number(),
  }).optional().nullable(),
  existingNotesSummary: z.string().optional().nullable(),
  originalBusinessCardImageUrl: z.string().optional().nullable(),
}).refine(data => {
  if (data.hasTDSReading && (data.tdsValue === undefined || data.tdsValue === null || isNaN(data.tdsValue))) {
    return false;
  }
  return true;
}, {
  message: "TDS value is required when TDS Reading is checked.",
  path: ["tdsValue"],
});


export async function saveVisitAction(payload: SaveVisitPayload): Promise<{ visit?: Visit; error?: string, isNewVisit?: boolean }> {
  if (!db) {
    return { error: 'Firebase is not configured. Cannot save visit.' };
  }
  try {
    const validatedPayload = saveVisitPayloadSchema.parse(payload);

    let contactDetails: ContactInfo | undefined = validatedPayload.existingContactInfo ?? undefined;
    let summary: string | undefined = validatedPayload.existingNotesSummary ?? undefined;

    const isNewVisit = !validatedPayload.id;
    const companyChanged = !isNewVisit && validatedPayload.companyName !== validatedPayload.originalCompanyName;
    const notesChanged = !isNewVisit && validatedPayload.notes !== validatedPayload.originalNotes;

    if ((isNewVisit || companyChanged) && validatedPayload.companyName) {
      try {
        const contactResult = await scrapeContactInfo({ companyName: validatedPayload.companyName });
        contactDetails = {
            info: contactResult.contactInfo,
            confidence: contactResult.confidenceScore,
        };
      } catch (e: any) {
        console.warn("Failed to scrape contact info:", e);
        contactDetails = { info: "Could not retrieve contact info.", confidence: 0 };
      }
    }

    if (validatedPayload.notes && validatedPayload.notes.trim() !== '' && (isNewVisit || notesChanged)) {
      try {
        const summaryResult = await summarizeVisitNotes({ notes: validatedPayload.notes });
        summary = summaryResult.summary;
      } catch (e: any) {
        console.warn("Failed to summarize notes:", e);
        summary = "Could not summarize notes.";
      }
    }

    const visit: Visit = {
      id: validatedPayload.id || uuidv4(),
      timestamp: validatedPayload.timestamp || new Date(),
      companyName: validatedPayload.companyName,
      notes: validatedPayload.notes ?? undefined,
      latitude: validatedPayload.latitude ?? undefined,
      longitude: validatedPayload.longitude ?? undefined,
      contactInfo: contactDetails,
      notesSummary: summary,
      partnershipConfidence: validatedPayload.partnershipConfidence ?? undefined,
      hasBusinessCard: !!validatedPayload.hasBusinessCard,
      businessCardImageUrl: validatedPayload.businessCardImageUrl ?? undefined,
      discussedCompetitors: !!validatedPayload.competitorName,
      competitorName: validatedPayload.competitorName ?? undefined,
      coolerType: validatedPayload.competitorName ? (validatedPayload.coolerType ?? undefined) : undefined,
      decisionMakerName: validatedPayload.decisionMakerName ?? undefined,
      decisionMakerTitle: validatedPayload.decisionMakerTitle ?? undefined,
      decisionMakerContact: validatedPayload.decisionMakerContact ?? undefined,
      visitNumber: validatedPayload.visitNumber ?? undefined,
      interestedUnit: validatedPayload.interestedUnit ?? undefined,
      hasTDSReading: !!validatedPayload.hasTDSReading,
      tdsValue: validatedPayload.hasTDSReading ? (validatedPayload.tdsValue ?? undefined) : undefined,
      futureMeetingSet: !!validatedPayload.futureMeetingSet,
      futureMeetingDateTime: validatedPayload.futureMeetingDateTime ?? undefined,
      freeTrial: !!validatedPayload.freeTrial,
      dealClosed: !!validatedPayload.dealClosed,
    };

    const visitDataForFirestore = Object.fromEntries(
      Object.entries(visit).map(([key, value]) => [key, value === undefined ? null : value])
    );

    const visitDocRef = doc(db, 'visits', visit.id!);
    await setDoc(visitDocRef, visitDataForFirestore, { merge: true });

    return { visit, isNewVisit };
  } catch (error: any) {
    console.error("Error in saveVisitAction:", error);
    if (error instanceof z.ZodError) {
        return { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
    }
    const errorMessage = error?.message?.toLowerCase() || '';
    if (errorMessage.includes('api key is invalid')) {
        return { error: "Failed to save visit. The AI API key is invalid or expired. Please check your configuration." };
    }
    return { error: `Failed to save visit: ${error.message || 'An unexpected error occurred.'}` };
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
  csvData: z.string().optional(),
  territoryPdfUrl: z.string().optional(),
  managedFiles: z.array(z.object({
    name: z.string(),
    url: z.string(),
    type: z.string(),
    uploadedAt: z.string(),
  })).optional(),
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
      csvData: validatedPayload.csvData,
      territoryPdfUrl: validatedPayload.territoryPdfUrl,
      managedFiles: validatedPayload.managedFiles?.map(f => ({ name: f.name, url: f.url })),
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
  places?: {
    companyName: string;
    address: string;
    city: string;
    phone: string;
    latitude?: number;
    longitude?: number;
  }[];
  error?: string
}> {
  try {
    const validatedPayload = findCompanySchema.parse(payload);
    const query = `${validatedPayload.companyName}${validatedPayload.city ? `, ${validatedPayload.city}` : ''}`;

    const results = await findPlacesFromText(query);
    if (!results || results.length === 0) {
      return { error: 'Company not found.' };
    }

    const places = results.map(result => ({
        companyName: result.suggestedCompanyName,
        address: result.address,
        city: result.city,
        phone: result.phone,
        latitude: result.latitude,
        longitude: result.longitude,
    }));
    return { places };
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

    
    