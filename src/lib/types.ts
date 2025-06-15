export interface ContactInfo {
  info: string;
  confidence: number;
}

export interface Visit {
  id: string;
  timestamp: Date;
  latitude?: number;
  longitude?: number;
  companyName: string;
  notes?: string;
  contactInfo?: ContactInfo;
  notesSummary?: string;
  partnershipConfidence?: number; // 1-5 stars
  hasBusinessCard?: boolean;
  discussedCompetitors?: boolean;
  competitorName?: string;
  coolerType?: string; // Added for selected cooler type
  decisionMakerName?: string;
  decisionMakerTitle?: string;
  decisionMakerContact?: string;
}

export interface Salesperson {
  id: string;
  name: string;
}
