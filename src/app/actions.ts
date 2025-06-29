'use server';

import { scrapeContactInfo } from '@/ai/flows/scrape-contact-info';
import { summarizeVisitNotes } from '@/ai/flows/summarize-visit-notes';
import { getCompanyNameFromCoords } from '@/ai/flows/get-company-name-from-coords.ts';
import { chatWithVisits } from '@/ai/flows/chat-with-visits-flow.ts';
import { findOptimalParking } from '@/ai/flows/find-optimal-parking-flow.ts';
import { extractCitiesFromPdf } from '@/ai/flows/extract-cities-from-pdf-flow';
import { findPlacesFromText } from '@/services/google-places';
import type { Visit, ContactInfo, ManagedFile } from '@/lib/types';
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

export async function saveVisitAction(payload: SaveVisitPayload): Promise<{ visit?: Visit; error?: string; isNewVisit?: boolean }> {
  if (!db) {
    return { error: 'Firebase is not configured. Cannot save visit.' };
  }

  try {
    const visitId = payload.id || uuidv4();
    const isNewVisit = !payload.id;

    // Step 1: Basic validation
    if (!payload.companyName || payload.companyName.trim() === '') {
      return { error: 'Company name is required.' };
    }

    // Step 2: Build the database object defensively.
    // This approach is more verbose but much safer.
    // It ensures every field is explicitly handled and no `undefined` values are sent to Firestore.
    const visitForDb: Omit<Visit, 'id'> = {
      // Required fields
      companyName: payload.companyName.trim(),
      timestamp: (payload.timestamp && new Date(payload.timestamp).toString() !== 'Invalid Date') ? new Date(payload.timestamp) : new Date(),

      // Optional fields initialized to null or a safe default
      notes: null,
      latitude: null,
      longitude: null,
      partnershipConfidence: null,
      contactInfo: null,
      notesSummary: payload.existingNotesSummary || null,
      hasBusinessCard: false,
      businessCardImageUrl: null,
      discussedCompetitors: false,
      competitorName: null,
      coolerType: null,
      decisionMakerName: null,
      decisionMakerTitle: null,
      decisionMakerContact: null,
      visitNumber: payload.visitNumber || null,
      interestedUnit: null,
      hasTDSReading: false,
      tdsValue: null,
      futureMeetingSet: false,
      futureMeetingDateTime: null,
      freeTrial: false,
      dealClosed: payload.dealClosed || false,
    };

    // Populate optional fields only if they have a valid value
    if (payload.notes) visitForDb.notes = payload.notes;
    if (typeof payload.latitude === 'number') visitForDb.latitude = payload.latitude;
    if (typeof payload.longitude === 'number') visitForDb.longitude = payload.longitude;
    if (typeof payload.partnershipConfidence === 'number') visitForDb.partnershipConfidence = payload.partnershipConfidence;
    if (payload.existingContactInfo) visitForDb.contactInfo = payload.existingContactInfo;

    // Handle boolean flags and their dependent fields
    if (payload.hasBusinessCard === true) {
        visitForDb.hasBusinessCard = true;
        if (payload.businessCardImageUrl) {
            visitForDb.businessCardImageUrl = payload.businessCardImageUrl;
        }
    }
    
    if (payload.competitorName) {
        visitForDb.discussedCompetitors = true;
        visitForDb.competitorName = payload.competitorName;
        if (payload.coolerType) {
            visitForDb.coolerType = payload.coolerType;
        }
    }

    if (payload.decisionMakerName) visitForDb.decisionMakerName = payload.decisionMakerName;
    if (payload.decisionMakerTitle) visitForDb.decisionMakerTitle = payload.decisionMakerTitle;
    if (payload.decisionMakerContact) visitForDb.decisionMakerContact = payload.decisionMakerContact;
    if (payload.interestedUnit) visitForDb.interestedUnit = payload.interestedUnit;

    if (payload.hasTDSReading === true) {
        visitForDb.hasTDSReading = true;
        if (typeof payload.tdsValue === 'number' && !isNaN(payload.tdsValue)) {
            visitForDb.tdsValue = payload.tdsValue;
        }
    }

    if (payload.futureMeetingSet === true) {
        visitForDb.futureMeetingSet = true;
        if (payload.futureMeetingDateTime && new Date(payload.futureMeetingDateTime).toString() !== 'Invalid Date') {
            visitForDb.futureMeetingDateTime = new Date(payload.futureMeetingDateTime);
        }
    }
    
    if (payload.freeTrial === true) visitForDb.freeTrial = true;
    
    // If the notes have changed, run the AI summary in the background (don't await it).
    // The UI will update reactively if it succeeds.
    if (payload.notes && payload.notes !== payload.originalNotes) {
        summarizeVisitNotes({ notes: payload.notes })
            .then(summaryResult => {
                if (summaryResult.summary) {
                    const summaryUpdateRef = doc(db, 'visits', visitId);
                    setDoc(summaryUpdateRef, { notesSummary: summaryResult.summary }, { merge: true });
                }
            })
            .catch(e => console.error(`Non-critical error: Failed to generate summary for visit ${visitId}:`, e));
    }


    // Step 3: Save to Firestore
    const visitDocRef = doc(db, 'visits', visitId);
    await setDoc(visitDocRef, visitForDb, { merge: true });

    // Step 4: Prepare the return data for the client
    const finalVisitData: Visit = {
      ...visitForDb,
      id: visitId,
      timestamp: new Date(visitForDb.timestamp),
      futureMeetingDateTime: visitForDb.futureMeetingDateTime ? new Date(visitForDb.futureMeetingDateTime) : undefined,
    };

    return { visit: finalVisitData, isNewVisit };

  } catch (error: any) {
    console.error("CRITICAL ERROR IN saveVisitAction:", error);
    let userMessage = 'An unexpected error occurred during the save operation. Please check the server logs for more details.';
    
    if (error.message) {
        if (error.message.includes('permission-denied') || (error.code && error.code.includes('permission-denied'))) {
            userMessage = 'Failed to save: Permission denied. Please check your Firestore security rules.';
        } else if (error.message.includes('Document data maximum size')) {
            userMessage = 'Failed to save: The visit data is too large. This can be caused by a very large business card image. Please try a smaller image.';
        } else if (error.message.includes('invalid-argument') || (error.code && error.code.includes('invalid-argument'))) {
             userMessage = `Failed to save: Invalid data was sent to the database. This might be due to an unexpected value in the form. Details: ${error.message}`;
        } else {
             userMessage = `An error occurred: ${error.message}`;
        }
    }
    
    return { error: userMessage };
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
