
'use server';

import { scrapeContactInfo } from '@/ai/flows/scrape-contact-info';
import { summarizeVisitNotes } from '@/ai/flows/summarize-visit-notes';
import { getCompanyNameFromCoords } from '@/ai/flows/get-company-name-from-coords.ts';
import { chatWithVisits } from '@/ai/flows/chat-with-visits-flow.ts';
import { findOptimalParking } from '@/ai/flows/find-optimal-parking-flow.ts';
import { extractCitiesFromPdf } from '@/ai/flows/extract-cities-from-pdf-flow';
import { extractVisitDetails } from '@/ai/flows/extract-visit-details-flow';
import { getCompanyIntel } from '@/ai/flows/get-company-intel-flow.ts';
import { analyzeDocument } from '@/ai/flows/analyze-document-flow.ts';
import { findPlacesFromText, type PlaceDetails, type SearchBounds } from '@/services/google-places';
import type { Visit, ContactInfo, ManagedFile, Territory } from '@/lib/types';
import { z } from 'zod';
import { format } from 'date-fns';
import { db, firebaseConfigured } from '@/lib/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Storage } from '@google-cloud/storage';

const GOOGLE_API_DISABLED_ERROR = "Location services are temporarily disabled by the administrator.";

// The payload now directly uses fields from the Visit type, simplifying the data flow.
export interface SaveVisitPayload extends Omit<Visit, 'id' | 'timestamp'> {
  id?: string;
  timestamp?: Date;
}


export async function saveVisitAction(payload: SaveVisitPayload): Promise<{ visit?: Visit; error?: string; isNewVisit?: boolean }> {
  // CLOUD SYNC DISABLED FOR TESTING
  const isNewVisit = !payload.id || payload.id.startsWith('temp_');
  const visitId = isNewVisit ? uuidv4() : payload.id!;

  if (!payload.companyName || payload.companyName.trim() === '') {
    return { error: 'Company name is required.' };
  }

  const visitForDb: Omit<Visit, 'id' | 'dealClosed'> = {
      companyName: payload.companyName.trim(),
      city: payload.city ?? null,
      timestamp: (payload.timestamp && new Date(payload.timestamp).toString() !== 'Invalid Date') ? new Date(payload.timestamp) : new Date(),
      notes: payload.notes ?? null,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
      partnershipConfidence: typeof payload.partnershipConfidence === 'number' && !isNaN(payload.partnershipConfidence) ? payload.partnershipConfidence : null,
      hasBusinessCard: !!payload.hasBusinessCard,
      businessCardImageFrontUrl: payload.hasBusinessCard ? (payload.businessCardImageFrontUrl ?? null) : null,
      businessCardImageBackUrl: payload.hasBusinessCard ? (payload.businessCardImageBackUrl ?? null) : null,
      discussedCompetitors: !!payload.competitorName,
      competitorName: payload.competitorName ?? null,
      coolerType: payload.coolerType ?? null,
      decisionMakerName: payload.decisionMakerName ?? null,
      decisionMakerTitle: payload.decisionMakerTitle ?? null,
      decisionMakerContact: payload.decisionMakerContact ?? null,
      visitNumber: typeof payload.visitNumber === 'number' && !isNaN(payload.visitNumber) ? payload.visitNumber : null,
      interestedUnits: Array.isArray(payload.interestedUnits) ? payload.interestedUnits : [],
      hasTDSReading: !!payload.hasTDSReading,
      tdsValue: payload.hasTDSReading && typeof payload.tdsValue === 'number' && !isNaN(payload.tdsValue) ? payload.tdsValue : null,
      futureMeetingSet: !!payload.futureMeetingSet,
      futureMeetingDateTime: payload.futureMeetingSet && payload.futureMeetingDateTime && new Date(payload.futureMeetingDateTime).toString() !== 'Invalid Date' ? new Date(payload.futureMeetingDateTime) : null,
      freeTrial: !!payload.freeTrial,
      freeTrialStartDate: payload.freeTrial && payload.freeTrialStartDate && new Date(payload.freeTrialStartDate).toString() !== 'Invalid Date' ? new Date(payload.freeTrialStartDate) : null,
      pricingDiscussed: !!payload.pricingDiscussed,
      priceQuoted: payload.pricingDiscussed && typeof payload.priceQuoted === 'number' && !isNaN(payload.priceQuoted) ? payload.priceQuoted : null,
      leaseTerm: payload.pricingDiscussed && typeof payload.leaseTerm === 'number' && !isNaN(payload.leaseTerm) ? payload.leaseTerm : null,
      installationFee: payload.pricingDiscussed && typeof payload.installationFee === 'number' && !isNaN(payload.installationFee) ? payload.installationFee : null,
      creditApproved: !!payload.creditApproved,
      manualCommission: typeof payload.manualCommission === 'number' && !isNaN(payload.manualCommission) ? payload.manualCommission : null,
      notesSummary: payload.notesSummary ?? null,
      contactInfo: payload.contactInfo ?? null,
  };

  const finalVisitData: Visit = {
    ...visitForDb,
    id: visitId,
    dealClosed: payload.dealClosed || false,
    timestamp: new Date(visitForDb.timestamp),
    futureMeetingDateTime: visitForDb.futureMeetingDateTime ? new Date(visitForDb.futureMeetingDateTime) : undefined,
    freeTrialStartDate: visitForDb.freeTrialStartDate ? new Date(visitForDb.freeTrialStartDate) : undefined,
  };

  return { visit: finalVisitData, isNewVisit };
}

export async function deleteVisitAction(visitId: string): Promise<{ success?: boolean; error?: string }> {
    // CLOUD SYNC DISABLED FOR TESTING
    if (!visitId || visitId.startsWith('temp_')) {
        return { success: true };
    }
    return { success: true };
}

const getCompanyNameFromCoordsPayloadSchema = z.object({
    latitude: z.number(),
    longitude: z.number(),
});

export async function getCompanyNameFromCoordsAction(
    payload: { latitude?: number; longitude?: number; }
): Promise<{ suggestedCompanyName?: string; confidenceScore?: number; address?: string; city?: string; phone?: string; error?: string }> {
    const isGenkitConfigured = process.env.NEXT_PUBLIC_GENKIT_CONFIGURED === 'true';
    if (!isGenkitConfigured) {
        return { error: "AI features are currently disabled by the administrator." };
    }
    const validatedPayload = getCompanyNameFromCoordsPayloadSchema.safeParse(payload);
    if (!validatedPayload.success) {
        return { error: "Invalid latitude or longitude provided." };
    }
    try {
        const result = await getCompanyNameFromCoords(validatedPayload.data);
        return result;
    } catch (error: any) {
        return { error: error.message };
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
  newsItems: z.array(z.string()).optional(),
});

export async function getAiChatResponseAction(
  payload: z.infer<typeof aiChatPayloadSchema>
): Promise<{ aiResponse?: string; error?: string }> {
  const isGenkitConfigured = process.env.NEXT_PUBLIC_GENKIT_CONFIGURED === 'true';
  if (!isGenkitConfigured) {
    return { error: "AI features are currently disabled by the administrator." };
  }

  try {
    const aiResponse = await chatWithVisits(payload);
    return { aiResponse: aiResponse.aiResponse };
  } catch (error: any) {
    console.error("Error in getAiChatResponseAction:", error);
    return { error: error.message || "An unexpected error occurred." };
  }
}

const summarizeNotesSchema = z.object({
  notes: z.string().min(1, "Notes cannot be empty."),
});

export async function summarizeNotesAction(
  payload: z.infer<typeof summarizeNotesSchema>
): Promise<{ summary?: string; error?: string }> {
    const isGenkitConfigured = process.env.NEXT_PUBLIC_GENKIT_CONFIGURED === 'true';
    if (!isGenkitConfigured) {
        return { error: "AI features are currently disabled by the administrator." };
    }
    try {
        const result = await summarizeVisitNotes(payload);
        return { summary: result.summary };
    } catch (error: any) {
        return { error: error.message };
    }
}

const findOptimalParkingSchema = z.object({
  city: z.string().min(1, "City name is required."),
});

export async function findOptimalParkingAction(
  payload: z.infer<typeof findOptimalParkingSchema>
): Promise<{ latitude?: number; longitude?: number; locationDescription?: string; error?: string }> {
    const isGenkitConfigured = process.env.NEXT_PUBLIC_GENKIT_CONFIGURED === 'true';
    if (!isGenkitConfigured) {
        return { error: "AI features are currently disabled by the administrator." };
    }
    try {
        const result = await findOptimalParking(payload);
        return result;
    } catch (error: any) {
        return { error: error.message };
    }
}

const extractCitiesSchema = z.object({
  pdfDataUri: z.string().min(1, "PDF data URI is required."),
});

export async function extractCitiesFromPdfAction(
  payload: z.infer<typeof extractCitiesSchema>
): Promise<{ cities?: string[]; error?: string }> {
    const isGenkitConfigured = process.env.NEXT_PUBLIC_GENKIT_CONFIGURED === 'true';
    if (!isGenkitConfigured) {
        return { error: "AI features are currently disabled by the administrator." };
    }
    try {
        const result = await extractCitiesFromPdf(payload);
        return { cities: result.cities };
    } catch (error: any) {
        return { error: error.message };
    }
}

const findCompanySchema = z.object({
  companyName: z.string().min(1, "Company name is required."),
  city: z.string().optional(),
  territoryCities: z.array(z.string()).optional(),
  territory: z.array(z.object({
      name: z.string(),
      bounds: z.object({
        minLat: z.number(),
        maxLat: z.number(),
        minLng: z.number(),
        maxLng: z.number(),
      }),
      cities: z.array(z.string()).optional()
  })).optional()
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
    openingHours?: string[];
  }[];
  error?: string
}> {
    const isGenkitConfigured = process.env.NEXT_PUBLIC_GENKIT_CONFIGURED === 'true';
    if (!isGenkitConfigured) {
        return { error: "AI features are currently disabled by the administrator." };
    }
    try {
        const { companyName, city, territory } = payload;
        const query = city ? `${companyName}, ${city}` : companyName;
        
        let searchBounds: SearchBounds | undefined;
        if (territory && territory.length > 0) {
            searchBounds = territory.reduce((acc, t) => ({
                minLat: Math.min(acc.minLat, t.bounds.minLat),
                maxLat: Math.max(acc.maxLat, t.bounds.maxLat),
                minLng: Math.min(acc.minLng, t.bounds.minLng),
                maxLng: Math.max(acc.maxLng, t.bounds.maxLng),
            }), { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 });
        }

        const results = await findPlacesFromText(query, searchBounds);

        return { places: results.map(p => ({
            companyName: p.suggestedCompanyName,
            address: p.address,
            city: p.city,
            phone: p.phone,
            latitude: p.latitude,
            longitude: p.longitude,
            openingHours: p.openingHours,
        })) };

    } catch (error: any) {
        return { error: error.message };
    }
}

// Action to update the dealClosed status from the card
export async function updateDealClosedAction(visitId: string, dealClosed: boolean): Promise<{ success?: boolean, error?: string }> {
    // CLOUD SYNC DISABLED FOR TESTING
    if (!visitId) {
        return { error: 'Visit ID is required.' };
    }
    return { success: true };
}

export async function saveDailyReportAction(visits: Visit[], salespersonName?: string): Promise<{ success?: boolean; url?: string; error?: string }> {
  // CLOUD SYNC DISABLED FOR TESTING
  if (!visits || visits.length === 0) {
    return { error: 'No visits to generate a report for.' };
  }
  return { error: 'Cloud saving is disabled for testing.' };
}

const extractDetailsSchema = z.object({
  notes: z.string().min(1, "Notes cannot be empty."),
  currentDate: z.string(),
});

export async function extractVisitDetailsAction(
  payload: z.infer<typeof extractDetailsSchema>
): Promise<{ details?: z.infer<typeof import('@/ai/flows/extract-visit-details-flow').ExtractVisitDetailsOutput>; error?: string }> {
    const isGenkitConfigured = process.env.NEXT_PUBLIC_GENKIT_CONFIGURED === 'true';
    if (!isGenkitConfigured) {
        return { error: "AI features are currently disabled by the administrator." };
    }
    try {
        const result = await extractVisitDetails(payload);
        return { details: result };
    } catch (error: any) {
        return { error: error.message };
    }
}

const getCompanyIntelSchema = z.object({
  companyName: z.string().min(1, "Company name cannot be empty."),
  latitude: z.number(),
  longitude: z.number(),
});

export async function getCompanyIntelAction(
  payload: z.infer<typeof getCompanyIntelSchema>
): Promise<{ details?: z.infer<typeof import('@/ai/flows/get-company-intel-flow').GetCompanyIntelOutput>; error?: string }> {
    const isGenkitConfigured = process.env.NEXT_PUBLIC_GENKIT_CONFIGURED === 'true';
    if (!isGenkitConfigured) {
        return { error: "AI features are currently disabled by the administrator." };
    }
    try {
        const result = await getCompanyIntel(payload);
        return { details: result };
    } catch (error: any) {
        return { error: error.message };
    }
}

const analyzeDocumentSchema = z.object({
  documentUrl: z.string().url("A valid document URL is required."),
});

export async function analyzeDocumentAction(
  payload: z.infer<typeof analyzeDocumentSchema>
): Promise<{ summary?: string; error?: string }> {
    const isGenkitConfigured = process.env.NEXT_PUBLIC_GENKIT_CONFIGURED === 'true';
    if (!isGenkitConfigured) {
        return { error: "AI features are currently disabled by the administrator." };
    }
    try {
        const result = await analyzeDocument(payload);
        return { summary: result.summary };
    } catch (error: any) {
        return { error: error.message };
    }
}
