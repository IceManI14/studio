
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

const GOOGLE_API_DISABLED_ERROR = "Google API features are currently disabled by the administrator.";

// The payload now directly uses fields from the Visit type, simplifying the data flow.
export interface SaveVisitPayload extends Omit<Visit, 'id' | 'timestamp'> {
  id?: string;
  timestamp?: Date;
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

    const visitDocRef = doc(db, 'visits', visitId);
    await setDoc(visitDocRef, visitForDb, { merge: true });

    const finalVisitData: Visit = {
      ...visitForDb,
      id: visitId,
      dealClosed: payload.dealClosed || false,
      timestamp: new Date(visitForDb.timestamp),
      futureMeetingDateTime: visitForDb.futureMeetingDateTime ? new Date(visitForDb.futureMeetingDateTime) : undefined,
      freeTrialStartDate: visitForDb.freeTrialStartDate ? new Date(visitForDb.freeTrialStartDate) : undefined,
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
    if (!visitId || visitId.startsWith('temp_')) {
        return { success: true }; // Optimistically deleted, no need to call DB
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
    return { error: GOOGLE_API_DISABLED_ERROR };
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
  return { error: GOOGLE_API_DISABLED_ERROR };
}

const summarizeNotesSchema = z.object({
  notes: z.string().min(1, "Notes cannot be empty."),
});

export async function summarizeNotesAction(
  payload: z.infer<typeof summarizeNotesSchema>
): Promise<{ summary?: string; error?: string }> {
    return { error: GOOGLE_API_DISABLED_ERROR };
}

const findOptimalParkingSchema = z.object({
  city: z.string().min(1, "City name is required."),
});

export async function findOptimalParkingAction(
  payload: z.infer<typeof findOptimalParkingSchema>
): Promise<{ latitude?: number; longitude?: number; locationDescription?: string; error?: string }> {
    return { error: GOOGLE_API_DISABLED_ERROR };
}

const extractCitiesSchema = z.object({
  pdfDataUri: z.string().min(1, "PDF data URI is required."),
});

export async function extractCitiesFromPdfAction(
  payload: z.infer<typeof extractCitiesSchema>
): Promise<{ cities?: string[]; error?: string }> {
    return { error: GOOGLE_API_DISABLED_ERROR };
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
    return { error: GOOGLE_API_DISABLED_ERROR };
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

export async function saveDailyReportAction(visits: Visit[], salespersonName?: string): Promise<{ success?: boolean; url?: string; error?: string }> {
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
      'ID', 'Timestamp', 'Latitude', 'Longitude', 'Company Name', 'City', 'Notes', 
      'Contact Info', 'Contact Confidence', 'Notes Summary', 'Partnership Confidence',
      'Has Business Card', 'Business Card Front URL', 'Business Card Back URL', 'Discussed Competitors', 
      'Competitor Name', 'Cooler Type', 'Decision Maker Name', 'Decision Maker Title',
      'Decision Maker Contact', 'Visit Number', 'Interested Units', 'Has TDS Reading', 
      'TDS Value', 'Future Meeting Set', 'Future Meeting DateTime', 'Free Trial', 'Free Trial Start Date', 'Deal Closed',
      'Pricing Discussed', 'Price Quoted', 'Lease Term', 'Installation Fee', 'Credit Approved', 'Manual Commission Override'
    ];
    const rows = visits.map(visit => [
      visit.id,
      new Date(visit.timestamp).toISOString(),
      visit.latitude ?? '',
      visit.longitude ?? '',
      `"${(visit.companyName ?? '').replace(/"/g, '""')}"`,
      `"${(visit.city ?? '').replace(/"/g, '""')}"`,
      `"${(visit.notes ?? '').replace(/"/g, '""')}"`,
      `"${(visit.contactInfo?.info ?? '').replace(/"/g, '""')}"`,
      visit.contactInfo?.confidence ?? '',
      `"${(visit.notesSummary ?? '').replace(/"/g, '""')}"`,
      visit.partnershipConfidence ?? '',
      visit.hasBusinessCard ? 'Yes' : 'No',
      `"${(visit.businessCardImageFrontUrl ?? '').replace(/"/g, '""')}"`,
      `"${(visit.businessCardImageBackUrl ?? '').replace(/"/g, '""')}"`,
      visit.discussedCompetitors ? 'Yes' : 'No',
      `"${(visit.competitorName ?? '').replace(/"/g, '""')}"`,
      `"${(visit.coolerType ?? '').replace(/"/g, '""')}"`,
      `"${(visit.decisionMakerName ?? '').replace(/"/g, '""')}"`,
      `"${(visit.decisionMakerTitle ?? '').replace(/"/g, '""')}"`,
      `"${(visit.decisionMakerContact ?? '').replace(/"/g, '""')}"`,
      visit.visitNumber ?? '',
      `"${(visit.interestedUnits?.join('; ') ?? '').replace(/"/g, '""')}"`,
      visit.hasTDSReading ? 'Yes' : 'No',
      visit.tdsValue ?? '',
      visit.futureMeetingSet ? 'Yes' : 'No',
      visit.futureMeetingDateTime ? new Date(visit.futureMeetingDateTime).toISOString() : '',
      visit.freeTrial ? 'Yes' : 'No',
      visit.freeTrialStartDate ? new Date(visit.freeTrialStartDate).toISOString() : '',
      visit.dealClosed ? 'Yes' : 'No',
      visit.pricingDiscussed ? 'Yes' : 'No',
      visit.priceQuoted ?? '',
      visit.leaseTerm ?? '',
      visit.installationFee ?? '',
      visit.creditApproved ? 'Yes' : 'No',
      visit.manualCommission ?? '',
    ].join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    
    const safeSalespersonName = salespersonName ? salespersonName.replace(/[^a-zA-Z0-9]/g, '_') : 'user';
    const reportDate = format(new Date(), 'yyyy-MM-dd');
    const fileName = `trails/trail_report_${safeSalespersonName}_${reportDate}.csv`;
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

const extractDetailsSchema = z.object({
  notes: z.string().min(1, "Notes cannot be empty."),
});

export async function extractVisitDetailsAction(
  payload: z.infer<typeof extractDetailsSchema>
): Promise<{ details?: z.infer<typeof import('@/ai/flows/extract-visit-details-flow').ExtractVisitDetailsOutput>; error?: string }> {
    return { error: GOOGLE_API_DISABLED_ERROR };
}

const getCompanyIntelSchema = z.object({
  companyName: z.string().min(1, "Company name cannot be empty."),
  latitude: z.number(),
  longitude: z.number(),
});

export async function getCompanyIntelAction(
  payload: z.infer<typeof getCompanyIntelSchema>
): Promise<{ details?: z.infer<typeof import('@/ai/flows/get-company-intel-flow').GetCompanyIntelOutput>; error?: string }> {
    return { error: GOOGLE_API_DISABLED_ERROR };
}

const analyzeDocumentSchema = z.object({
  documentUrl: z.string().url("A valid document URL is required."),
});

export async function analyzeDocumentAction(
  payload: z.infer<typeof analyzeDocumentSchema>
): Promise<{ summary?: string; error?: string }> {
    return { error: GOOGLE_API_DISABLED_ERROR };
}


    

    


