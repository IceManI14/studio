
export interface ContactInfo {
  info: string;
  confidence: number;
}

export interface Territory {
  name: string;
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  cities?: string[];
}

export interface Visit {
  id: string;
  timestamp: Date;
  latitude?: number;
  longitude?: number;
  companyName: string;
  city?: string | null;
  notes?: string | null;
  contactInfo?: ContactInfo | null;
  notesSummary?: string | null;
  partnershipConfidence?: number | null; // 1-5 stars
  hasBusinessCard?: boolean;
  businessCardImageFrontUrl?: string | null;
  businessCardImageBackUrl?: string | null;
  discussedCompetitors?: boolean;
  competitorName?: string | null;
  coolerType?: string | null; 
  decisionMakerName?: string | null;
  decisionMakerTitle?: string | null;
  decisionMakerContact?: string | null;
  visitNumber?: number | null; 
  interestedUnits?: string[] | null; 
  hasTDSReading?: boolean;
  tdsValue?: number | null;
  futureMeetingSet?: boolean;
  futureMeetingDateTime?: Date;
  freeTrial?: boolean;
  freeTrialStartDate?: Date;
  dealClosed?: boolean;
  pricingDiscussed?: boolean;
  priceQuoted?: number | null;
  leaseTerm?: number | null;
  installationFee?: number | null;
  creditApproved?: boolean;
  manualCommission?: number | null;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export interface Salesperson {
  id: string;
  name: string;
  territory: Territory[];
}

export interface ManagedFile {
  name: string;
  url: string;
  type: string;
  uploadedAt: string;
}

export interface FoundPlace {
    companyName: string;
    address: string;
    city: string;
    phone: string;
    latitude?: number;
    longitude?: number;
    openingHours?: string[];
}

export interface HotLead {
  id: string;
  companyName: string;
  address: string;
  city: string;
  phone: string;
  latitude?: number;
  longitude?: number;
  addedAt: Date;
  notes?: string;
}

export interface CompanyDoc {
  id: string;
  name: string;
  url: string;
}
