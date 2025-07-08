

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
  notes?: string;
  contactInfo?: ContactInfo;
  notesSummary?: string;
  partnershipConfidence?: number; // 1-5 stars
  hasBusinessCard?: boolean;
  businessCardImageUrl?: string | null; // URL of the uploaded business card image
  discussedCompetitors?: boolean;
  competitorName?: string;
  coolerType?: string; // Added for selected cooler type
  decisionMakerName?: string;
  decisionMakerTitle?: string;
  decisionMakerContact?: string;
  visitNumber?: number; // Sequential number of the visit for the day
  interestedUnit?: string; // Unit the company is potentially interested in
  hasTDSReading?: boolean;
  tdsValue?: number;
  futureMeetingSet?: boolean;
  futureMeetingDateTime?: Date;
  freeTrial?: boolean;
  freeTrialStartDate?: Date;
  dealClosed?: boolean;
  pricingDiscussed?: boolean;
  priceQuoted?: number;
  leaseTerm?: number;
  installationFee?: number;
  creditApproved?: boolean;
  manualCommission?: number;
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
