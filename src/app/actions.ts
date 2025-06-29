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
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

export interface SaveVisitPayload {
  id?: string;
  timestamp?: Date;
  companyName: string;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  partnershipConfidence?: number | null;
  hasBusinessCard?: boolean | null;
  businessCardImageUrl?: string | null;
  competitorName?: string | null;
  coolerType?: string | null;
  decisionMakerName?: string | null;
  decisionMakerTitle?: string | null;
  decisionMakerContact?: string | null;
  visitNumber?: number | null;
  interestedUnit?: string | null;
  hasTDSReading?: boolean | null;
  tdsValue?: number | null;
  futureMeetingSet?: boolean | null;
  futureMeetingDateTime?: Date | null;
  freeTrial?: boolean | null;
  dealClosed?: boolean | null;
  originalCompanyName?: string | null;
  originalNotes?: string | null;
  existingContactInfo?: ContactInfo | null;
  existingNotesSummary?: string | null;
  originalBusinessCardImageUrl?: string | null;
}

function isValidDate(d: any) {
  return d instanceof Date && !isNaN(d.getTime());
}

const saveVisitPayloadSchema = z.object({
    id: z.string().optional(),
    timestamp: z.preprocess((arg) => {
        if (!arg) return new Date(); // Default to now if not provided
        const d = new Date(arg as string | number | Date);
        return isValidDate(d) ? d : new Date();
    }, z.date()),
    companyName: z.string().min(1, "Company name is required"),
    notes: z.string().nullish(),
    latitude: z.number().nullish(),
    longitude: z.number().nullish(),
    partnershipConfidence: z.preprocess(
      (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
      z.number().min(1).max(5).nullish()
    ),
    hasBusinessCard: z.boolean().default(false),
    businessCardImageUrl: z.string().nullish(),
    competitorName: z.string().nullish(),
    coolerType: z.string().nullish(),
    decisionMakerName: z.string().nullish(),
    decisionMakerTitle: z.string().nullish(),
    decisionMakerContact: z.string().nullish(),
    visitNumber: z.preprocess(
      (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
      z.number().nullish()
    ),
    interestedUnit: z.string().nullish(),
    hasTDSReading: z.boolean().default(false),
    tdsValue: z.preprocess(
      (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
      z.number().min(0).max(1500).nullish()
    ),
    futureMeetingSet: z.boolean().default(false),
    futureMeetingDateTime: z.preprocess((arg) => {
        if (!arg) return null;
        const d = new Date(arg as string | number | Date);
        return isValidDate(d) ? d : null;
    }, z.date().nullish()),
    freeTrial: z.boolean().default(false),
    dealClosed: z.boolean().default(false),
    originalCompanyName: z.string().nullish(),
    originalNotes: z.string().nullish(),
    existingContactInfo: z.any().optional(),
    existingNotesSummary: z.string().nullish(),
}).refine(data => !data.hasTDSReading || (data.tdsValue !== null && data.tdsValue !== undefined), {
    message: "TDS value is required when TDS Reading is checked.",
    path: ["tdsValue"],
}).refine(data => !data.futureMeetingSet || data.futureMeetingDateTime, {
    message: "A meeting date and time is required when Future Meeting is checked.",
    path: ["futureMeetingDateTime"],
});


export interface QuickCreateVisitPayload {
  latitude: number;
  longitude: number;
  visitNumber: number;
}

const quickCreateVisitPayloadSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  visitNumber: z.number(),
});

export async function quickCreateVisitAction(payload: QuickCreateVisitPayload): Promise<{ visit?: Visit; error?: string }> {
  if (!db) {
    return { error: 'Firebase is not configured. Cannot save visit.' };
  }
  try {
    const { latitude, longitude, visitNumber } = quickCreateVisitPayloadSchema.parse(payload);
    
    let companyDetails: any = {};
    try {
      companyDetails = await getCompanyNameFromCoords({ latitude, longitude });
    } catch (e: any) {
      console.warn("AI Warning: Could not get company details for quick-log.", e.message);
    }

    const visitId = uuidv4();
    const newVisit: Visit = {
        id: visitId,
        timestamp: new Date(),
        latitude,
        longitude,
        companyName: companyDetails.suggestedCompanyName || 'New Quick-Logged Visit',
        notes: companyDetails.address ? `Suggested Address: ${companyDetails.address}` : `Quick-logged visit at location.`,
        contactInfo: companyDetails.phone ? { info: companyDetails.phone, confidence: 0.9 } : null,
        notesSummary: null,
        partnershipConfidence: null,
        hasBusinessCard: false,
        businessCardImageUrl: null,
        discussedCompetitors: false,
        competitorName: null,
        coolerType: null,
        decisionMakerName: null,
        decisionMakerTitle: null,
        decisionMakerContact: companyDetails.phone || null,
        visitNumber: visitNumber,
        interestedUnit: null,
        hasTDSReading: false,
        tdsValue: null,
        futureMeetingSet: false,
        futureMeetingDateTime: null,
        freeTrial: false,
        dealClosed: false,
    };
    
    const { id, ...visitForDb } = newVisit;
    const visitDocRef = doc(db, 'visits', id);
    await setDoc(visitDocRef, visitForDb);

    return { visit: newVisit };

  } catch (error: any) {
    console.error("Critical Error in quickCreateVisitAction:", error);
    if (error instanceof z.ZodError) {
        return { error: `Validation Error: ${error.errors.map(e => e.message).join(', ')}` };
    }
    return { error: `Failed to quick-create visit: ${error.message || 'An unexpected error occurred.'}` };
  }
}

export async function saveVisitAction(payload: SaveVisitPayload): Promise<{ visit?: Visit; error?: string, isNewVisit?: boolean }> {
  if (!db) {
    return { error: 'Firebase is not configured. Cannot save visit.' };
  }
  
  try {
    const validatedPayload = saveVisitPayloadSchema.parse(payload);
    
    const visitId = validatedPayload.id || uuidv4();
    const isNewVisit = !validatedPayload.id;

    let contactInfo = validatedPayload.existingContactInfo || null;
    if ((isNewVisit || validatedPayload.companyName !== validatedPayload.originalCompanyName) && validatedPayload.companyName) {
      try {
        const result = await scrapeContactInfo({ companyName: validatedPayload.companyName });
        contactInfo = { info: result.contactInfo, confidence: result.confidenceScore };
      } catch (e: any) {
        console.warn("AI Warning: Failed to scrape contact info.", e.message);
      }
    }
    
    let notesSummary = validatedPayload.existingNotesSummary || null;
    if (validatedPayload.notes && validatedPayload.notes !== validatedPayload.originalNotes) {
      try {
        const result = await summarizeVisitNotes({ notes: validatedPayload.notes });
        notesSummary = result.summary;
      } catch (e: any) {
        console.warn("AI Warning: Failed to summarize notes.", e.message);
      }
    }

    const visitData: Visit = {
      id: visitId,
      timestamp: validatedPayload.timestamp,
      companyName: validatedPayload.companyName,
      notes: validatedPayload.notes ?? null,
      latitude: validatedPayload.latitude ?? null,
      longitude: validatedPayload.longitude ?? null,
      partnershipConfidence: validatedPayload.partnershipConfidence ?? null,
      hasBusinessCard: validatedPayload.hasBusinessCard,
      businessCardImageUrl: validatedPayload.hasBusinessCard ? (validatedPayload.businessCardImageUrl ?? null) : null,
      competitorName: validatedPayload.competitorName ?? null,
      coolerType: validatedPayload.competitorName ? (validatedPayload.coolerType ?? null) : null,
      decisionMakerName: validatedPayload.decisionMakerName ?? null,
      decisionMakerTitle: validatedPayload.decisionMakerTitle ?? null,
      decisionMakerContact: validatedPayload.decisionMakerContact ?? null,
      visitNumber: validatedPayload.visitNumber ?? null,
      interestedUnit: validatedPayload.interestedUnit ?? null,
      hasTDSReading: validatedPayload.hasTDSReading,
      tdsValue: validatedPayload.hasTDSReading ? (validatedPayload.tdsValue ?? null) : null,
      futureMeetingSet: validatedPayload.futureMeetingSet,
      futureMeetingDateTime: validatedPayload.futureMeetingSet ? (validatedPayload.futureMeetingDateTime ?? null) : null,
      freeTrial: validatedPayload.freeTrial,
      dealClosed: validatedPayload.dealClosed ?? false,
      contactInfo,
      notesSummary,
      discussedCompetitors: !!validatedPayload.competitorName,
    };
    
    const { id, ...visitForDb } = visitData;

    const visitDocRef = doc(db, 'visits', id);
    await setDoc(visitDocRef, visitForDb, { merge: true });

    return { visit: visitData, isNewVisit };
    
  } catch (error: any) {
    console.error("Critical Error in saveVisitAction:", error);
    if (error instanceof z.ZodError) {
        return { error: `Validation Error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}` };
    }
    return { error: `Failed to save visit: ${error.message || 'An unexpected error occurred.'}` };
  }
}

export async function deleteVisitAction(visitId: string): Promise<{ success?: boolean; error?: string }> {
    if (!db) {
        return { error: 'Firebase is not configured. Cannot delete visit.' };
    }
    if (!visitId) {
        return { error: 'Visit ID is required.' };
    }

    try {
        const visitDocRef = doc(db, 'visits', visitId);
        await deleteDoc(visitDocRef);
        return { success: true };
    } catch (error: any) {
        console.error("Error in deleteVisitAction:", error);
        return { error: `Failed to delete visit: ${error.message}` };
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