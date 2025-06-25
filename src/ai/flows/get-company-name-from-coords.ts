
'use server';
/**
 * @fileOverview AI flow to suggest a company name and pertinent details based on GPS coordinates.
 *
 * - getCompanyNameFromCoords - A function that suggests a company name from latitude and longitude.
 * - GetCompanyNameFromCoordsInput - The input type for the getCompanyNameFromCoords function.
 * - GetCompanyNameFromCoordsOutput - The return type for the getCompanyNameFromCoords function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GetCompanyNameFromCoordsInputSchema = z.object({
  latitude: z.number().describe('The latitude of the location.'),
  longitude: z.number().describe('The longitude of the location.'),
});
export type GetCompanyNameFromCoordsInput = z.infer<typeof GetCompanyNameFromCoordsInputSchema>;

const GetCompanyNameFromCoordsOutputSchema = z.object({
  suggestedCompanyName: z.string().describe('The suggested company name found at the coordinates. Empty if none found.'),
  confidenceScore: z.number().describe('A score between 0.0 and 1.0 indicating the confidence in the suggestion.'),
  address: z.string().optional().describe("The street address of the company, if found."),
  phone: z.string().optional().describe("A contact phone number for the company, if found."),
});
export type GetCompanyNameFromCoordsOutput = z.infer<typeof GetCompanyNameFromCoordsOutputSchema>;

export async function getCompanyNameFromCoords(input: GetCompanyNameFromCoordsInput): Promise<GetCompanyNameFromCoordsOutput> {
  return getCompanyNameFromCoordsFlow(input);
}

const mockCompanyNames = [
  "Apex Innovations", "Stellar Solutions", "Quantum Dynamics", "FusionForward", "Zenith Enterprises",
  "Pinnacle Corp", "Momentum Industries", "Synergy Group", "Catalyst Creations", "Precision Pro",
  "Evergreen Logistics", "Silverline Tech", "Blue-sky Ventures", "Ironclad Security", "Summit Services",
  "Horizon Manufacturing", "Nexus Data Systems", "Gateway Properties", "Vanguard Financial", "Triton Global",
  "Seacoast Supplies", "Granite State Goods", "Pine Tree Provisions", "Lakes Region Logistics"
];

const mockStreetNames = [
  "Innovation Drive", "Commerce Street", "Market Avenue", "Enterprise Way", "Tech Park Circle", "Industrial Boulevard",
  "Founders Lane", "Discovery Court", "Liberty Pike", "Progressive Avenue", "Main Street", "Ocean Boulevard", "Lafayette Road", "Route 1"
];

const mockCitiesNH = ["Auburn", "Chester", "Kingston", "Seabrook", "Exeter", "Stratham", "Newmarket", "Durham", "Portsmouth", "Deerfield", "Nottingham", "Hampton", "Rye", "Sandown", "Raymond", "Hampstead", "Dover", "Tilton", "Belmont", "Franklin", "Laconia", "New Hampton", "Meredith", "Gilford"];
const mockCitiesME = ["Kittery", "York", "Ogunquit", "Wells", "Kennebunk"];

const mockReverseGeocodeTool = ai.defineTool(
  {
    name: 'mockReverseGeocodeTool',
    description: 'Mocks a reverse geocoding lookup to get address and place details from GPS coordinates. In a real app, this would call a geocoding API.',
    inputSchema: GetCompanyNameFromCoordsInputSchema,
    outputSchema: z.object({
      locationDescription: z.string().describe('A textual description of the location, potentially including address, phone numbers, and nearby points of interest or company names.'),
    }),
  },
  async ({ latitude, longitude }) => {
    // Use a simple hashing function on coordinates to get a pseudo-random yet deterministic index for the mocks.
    const latInt = Math.floor(Math.abs(latitude * 1000)) % 1000;
    const lonInt = Math.floor(Math.abs(longitude * 1000)) % 1000;
    
    const nameIndex = (latInt + lonInt) % mockCompanyNames.length;
    const streetIndex = (latInt * 3 + lonInt * 7) % mockStreetNames.length;

    let city: string;
    let state: string;

    // Simple geographical check for NH/ME border area. Longitude for Kittery, ME is ~ -70.7
    // This is a rough approximation for mock purposes.
    if (longitude > -70.8) {
        state = "ME";
        const cityIndex = (latInt + lonInt) % mockCitiesME.length;
        city = mockCitiesME[cityIndex];
    } else {
        state = "NH";
        const cityIndex = (latInt + lonInt) % mockCitiesNH.length;
        city = mockCitiesNH[cityIndex];
    }

    const companyName = mockCompanyNames[nameIndex];
    const streetName = mockStreetNames[streetIndex];
    const streetNumber = (latInt % 1500) + 1;
    const phoneSuffix = (lonInt % 9000) + 1000;
    
    const address = `${streetNumber} ${streetName}, ${city}, ${state}`;
    const phone = `(555) 555-${phoneSuffix.toString().padStart(4, '0')}`;

    // Return a more dynamic description based on the generated mock data.
    return { locationDescription: `Location at ${address}. Identified business: "${companyName}". Contact phone: ${phone}.` };
  }
);


const prompt = ai.definePrompt({
  name: 'getCompanyNameFromCoordsPrompt',
  input: { schema: z.object({ locationDescription: z.string() }) },
  output: { schema: GetCompanyNameFromCoordsOutputSchema },
  tools: [mockReverseGeocodeTool], // Though the tool is called by the flow directly, listing it can be good practice if the prompt needed to decide
  prompt: `You are an expert at identifying company names and their contact details from location descriptions.
Given the following location information: {{{locationDescription}}}

Extract the most likely primary company name, its address, and its phone number.
- If a clear company name is present, provide it.
- If the location seems residential or no specific company is identifiable, return an empty string for 'suggestedCompanyName'.
- If an address or phone number is present, extract it. Otherwise, leave the fields blank.
- Provide a confidence score (a number between 0.0 for no confidence and 1.0 for high confidence) for your identification. For these mock suggestions, use a confidence score between 0.7 and 0.9.

Your response must be in the format specified by the output schema.
`,
});

const getCompanyNameFromCoordsFlow = ai.defineFlow(
  {
    name: 'getCompanyNameFromCoordsFlow',
    inputSchema: GetCompanyNameFromCoordsInputSchema,
    outputSchema: GetCompanyNameFromCoordsOutputSchema,
  },
  async (input) => {
    const geocodeResult = await mockReverseGeocodeTool(input);
    
    const { output } = await prompt({ locationDescription: geocodeResult.locationDescription });
    
    if (!output) {
        return { suggestedCompanyName: '', confidenceScore: 0.1 };
    }
    // For mocked data, let's assign a dynamic-looking confidence score
    if (output.suggestedCompanyName) {
        const hash = (output.suggestedCompanyName.charCodeAt(0) || 7) * (output.suggestedCompanyName.charCodeAt(1) || 3);
        output.confidenceScore = 0.7 + (hash % 21) / 100; // e.g., 0.7 to 0.9
    }
    
    return output;
  }
);
