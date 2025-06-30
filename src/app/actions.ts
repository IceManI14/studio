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
import { db, firebaseConfigured } from '@/lib/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Storage } from '@google-cloud/storage';

// The payload now directly uses fields from the Visit type, simplifying the data flow.
export interface SaveVisitPayload extends Omit<Visit, 'id'> {
  id?: string;
}


export async function saveVisitAction(payload: SaveVisitPayload): Promise<{ visit?: Visit; error?: string; isNewVisit?: boolean }> {
  if (!db) {
    return { error: 'Firebase is not configured. Cannot save visit.' };
  }

  try {
    const isNewVisit = !payload.id || payload.id.startsWith('temp_');
    const visitId = isNewVisit ? uuidv4() : payload.id!;

    if (!payload.companyName || payload.companyName.trim() === '') {
      return { error: 'Company name is required.' };
    }

    // --- Defensive Data Sanitization ---
    // Each field is meticulously checked and sanitized to prevent invalid data from reaching Firestore.
    // This robust approach prevents the server crashes that were causing the "unexpected error".
    const visitForDb: Omit<Visit, 'id' | 'dealClosed'> = {
      companyName: payload.companyName.trim(),
      timestamp: (payload.timestamp && new Date(payload.timestamp).toString() !== 'Invalid Date') ? new Date(payload.timestamp) : new Date(),
      notes: payload.notes ?? null,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
      partnershipConfidence: payload.partnershipConfidence ?? null,
      hasBusinessCard: payload.hasBusinessCard || false,
      businessCardImageUrl: (payload.hasBusinessCard || false) ? payload.businessCardImageUrl ?? null : null,
      discussedCompetitors: !!payload.competitorName,
      competitorName: payload.competitorName ?? null,
      coolerType: (!!payload.competitorName) ? (payload.coolerType ?? null) : null,
      decisionMakerName: payload.decisionMakerName ?? null,
      decisionMakerTitle: payload.decisionMakerTitle ?? null,
      decisionMakerContact: payload.decisionMakerContact ?? null,
      visitNumber: payload.visitNumber ?? null,
      interestedUnit: payload.interestedUnit ?? null,
      hasTDSReading: payload.hasTDSReading || false,
      tdsValue: (payload.hasTDSReading || false) && typeof payload.tdsValue === 'number' && !isNaN(payload.tdsValue) ? payload.tdsValue : null,
      futureMeetingSet: payload.futureMeetingSet || false,
      futureMeetingDateTime: (payload.futureMeetingSet || false) && payload.futureMeetingDateTime && new Date(payload.futureMeetingDateTime).toString() !== 'Invalid Date' ? new Date(payload.futureMeetingDateTime) : null,
      freeTrial: payload.freeTrial || false,
      notesSummary: payload.notesSummary ?? null,
      contactInfo: payload.contactInfo ?? null,
    };

    // --- Save to Firestore ---
    const visitDocRef = doc(db, 'visits', visitId);
    await setDoc(visitDocRef, visitForDb, { merge: true });

    // --- Prepare the return object ---
    const finalVisitData: Visit = {
      ...visitForDb,
      id: visitId,
      dealClosed: payload.dealClosed || false,
      timestamp: new Date(visitForDb.timestamp),
      futureMeetingDateTime: visitForDb.futureMeetingDateTime ? new Date(visitForDb.futureMeetingDateTime) : undefined,
    };

    return { visit: finalVisitData, isNewVisit };

  } catch (error: any) {
    console.error("CRITICAL ERROR IN saveVisitAction:", error);
    const errorMessage = String(error?.message || '').toLowerCase();
    const errorCode = String(error?.code || '').toLowerCase();

    if (errorCode.includes('permission-denied') || errorMessage.includes('permission denied')) {
        return { error: 'Failed to save: Permission denied. Please check your Firestore security rules.' };
    }
    if (errorMessage.includes('document data maximum size')) {
        return { error: 'Failed to save: The visit data is too large. This can be caused by a very large business card image. Please try a smaller image.' };
    }
    if (errorCode.includes('invalid-argument') || errorMessage.includes('invalid argument')) {
         return { error: `Failed to save: Invalid data was sent to the database. Details: ${error.message}` };
    }

    return { error: `An unexpected error occurred during the save operation. Details: ${error.message || 'No specific error message was provided.'}` };
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

// Action to update the dealClosed status from the card
export async function updateDealClosedAction(visitId: string, dealClosed: boolean): Promise<{ success?: boolean, error?: string }> {
    if (!db) {
        return { error: 'Firebase is not configured. Cannot update visit.' };
    }
    if (!visitId) {
        return { error: 'Visit ID is required.' };
    }

    try {
        const visitDocRef = doc(db, 'visits', visitId);
        await setDoc(visitDocRef, { dealClosed }, { merge: true });
        return { success: true };
    } catch (error: any) {
        console.error("Error in updateDealClosedAction:", error);
        return { error: `Failed to update deal status: ${error.message}` };
    }
}

export async function saveDailyReportAction(visits: Visit[]): Promise<{ success?: boolean; url?: string; error?: string }> {
  if (!firebaseConfigured) {
    return { error: 'Firebase/GCS is not configured. Cannot save report.' };
  }
  if (!visits || visits.length === 0) {
    return { error: 'No visits to generate a report for.' };
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!projectId || !bucketName) {
    return { error: 'Server configuration error: Missing Firebase Project ID or Storage Bucket Name.' };
  }

  try {
    const storage = new Storage({ projectId });
    
    // CSV Generation Logic
    const headers = [
      'ID', 'Timestamp', 'Latitude', 'Longitude', 'Company Name', 'Notes', 
      'Contact Info', 'Contact Confidence', 'Notes Summary', 'Partnership Confidence',
      'Has Business Card', 'Business Card Image URL', 'Discussed Competitors', 
      'Competitor Name', 'Cooler Type', 'Decision Maker Name', 'Decision Maker Title',
      'Decision Maker Contact', 'Visit Number', 'Interested Unit', 'Has TDS Reading', 
      'TDS Value', 'Future Meeting Set', 'Future Meeting DateTime', 'Free Trial', 'Deal Closed'
    ];
    const rows = visits.map(visit => [
      visit.id,
      new Date(visit.timestamp).toISOString(),
      visit.latitude ?? '',
      visit.longitude ?? '',
      `"${(visit.companyName ?? '').replace(/"/g, '""')}"`,
      `"${(visit.notes ?? '').replace(/"/g, '""')}"`,
      `"${(visit.contactInfo?.info ?? '').replace(/"/g, '""')}"`,
      visit.contactInfo?.confidence ?? '',
      `"${(visit.notesSummary ?? '').replace(/"/g, '""')}"`,
      visit.partnershipConfidence ?? '',
      visit.hasBusinessCard ? 'Yes' : 'No',
      `"${(visit.businessCardImageUrl ?? '').replace(/"/g, '""')}"`,
      visit.discussedCompetitors ? 'Yes' : 'No',
      `"${(visit.competitorName ?? '').replace(/"/g, '""')}"`,
      `"${(visit.coolerType ?? '').replace(/"/g, '""')}"`,
      `"${(visit.decisionMakerName ?? '').replace(/"/g, '""')}"`,
      `"${(visit.decisionMakerTitle ?? '').replace(/"/g, '""')}"`,
      `"${(visit.decisionMakerContact ?? '').replace(/"/g, '""')}"`,
      visit.visitNumber ?? '',
      `"${(visit.interestedUnit ?? '').replace(/"/g, '""')}"`,
      visit.hasTDSReading ? 'Yes' : 'No',
      visit.tdsValue ?? '',
      visit.futureMeetingSet ? 'Yes' : 'No',
      visit.futureMeetingDateTime ? new Date(visit.futureMeetingDateTime).toISOString() : '',
      visit.freeTrial ? 'Yes' : 'No',
      visit.dealClosed ? 'Yes' : 'No',
    ].join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');

    const reportDate = format(new Date(), 'yyyy-MM-dd');
    const fileName = `reports/visits-${reportDate}.csv`;
    const file = storage.bucket(bucketName).file(fileName);

    await file.save(csvContent, {
      metadata: { contentType: 'text/csv' },
    });

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
    return { success: true, url: publicUrl };

  } catch (error: any) {
    console.error("Error in saveDailyReportAction:", error);
    const errorMessage = String(error?.message || '').toLowerCase();
    if (errorMessage.includes('could not refresh access token')) {
      return { error: 'Authentication Failed. To fix this, grant the "Service Account Token Creator" role to your app\'s service account in your Google Cloud IAM page.' };
    }
    if (errorMessage.includes('forbidden') || error.code === 403) {
      return { error: 'Permission Denied. The service account may need the "Storage Object Creator" role.' };
    }
    return { error: `Failed to save daily report to storage: ${error.message}` };
  }
}
