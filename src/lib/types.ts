
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
  businessCardImageUrl?: string; // URL of the uploaded business card image
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
