import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

if (!process.env.GEMINI_API_KEY) {
  console.error("CRITICAL: GEMINI_API_KEY is not defined in the environment. Lead generation will fail.");
}

export interface Lead {
  id: string;
  businessName: string;
  websiteUrl: string;
  industry: string;
  email: string;
  phone: string;
  socialMedia: {
    facebook?: string;
    linkedin?: string;
    instagram?: string;
  };
  websiteIssues: string[];
  opportunityScore: number;
  cms: string;
  details?: string;
}

export async function searchLeads(niche: string, location: string, count: number = 5): Promise<Lead[]> {
  const prompt = `Perform a deep web search for active businesses in the "${niche}" industry located in "${location}".
  Criteria:
  1. The business MUST use WordPress (this is critical).
  2. The website should have visible issues (design, speed, security, etc.).
  3. The business should have an active social media presence.
  
  For each of the ${count} businesses found, provide:
  - Accurate Business Name
  - Website URL
  - Contact Email (actual or inferred based on domain)
  - Phone Number
  - Social Media Links
  - At least 3 specific website issues found. IMPORTANT: Write these as concise, professional labels (e.g., "Mobile Optimization Gap", "Legacy UI Architecture", "Performance Latency", "SSL Security Vulnerability"). Avoid long sentences.
  - Opportunity Score (1-10) based on how desperately they need a redesign/optimization
  
  Return the results as a clean JSON array matching the specified schema.
  Use Google Search to verify current status.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              businessName: { type: Type.STRING },
              websiteUrl: { type: Type.STRING },
              industry: { type: Type.STRING },
              email: { type: Type.STRING },
              phone: { type: Type.STRING },
              socialMedia: {
                type: Type.OBJECT,
                properties: {
                  facebook: { type: Type.STRING },
                  linkedin: { type: Type.STRING },
                  instagram: { type: Type.STRING },
                }
              },
              websiteIssues: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              opportunityScore: { type: Type.NUMBER },
              cms: { type: Type.STRING },
              details: { type: Type.STRING }
            },
            required: ["businessName", "websiteUrl", "industry", "email", "websiteIssues", "opportunityScore"]
          }
        },
        tools: [{ googleSearch: {} }]
      }
    });

    const leads = JSON.parse(response.text || "[]");
    return leads.map((l: any) => ({
      ...l,
      id: Math.random().toString(36).substr(2, 9)
    }));
  } catch (error: any) {
    console.error("Error searching leads:", error);
    const errorMsg = error?.message || "Unknown error occurred while searching leads.";
    console.error("Gemini API Error details:", errorMsg);
    throw new Error(errorMsg);
  }
}

export async function generatePitch(lead: Lead): Promise<string> {
  const prompt = `Write a professional, persuasive outreach email for the business "${lead.businessName}". 
  Target URL: ${lead.websiteUrl}
  Industry: ${lead.industry}
  
  Identified Issues to mention:
  ${lead.websiteIssues.join(', ')}
  
  Goal: Offer WordPress redesign, speed optimization, and security hardening services. 
  The tone should be helpful and expert, not pushy. 
  Highlight how these improvements will help their conversion rate and SEO.
  
  Keep it concise and professional.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Failed to generate pitch.";
  } catch (error: any) {
    console.error("Error generating pitch:", error);
    const errorMsg = error?.message || "Unknown error occurred while generating pitch.";
    throw new Error(errorMsg);
  }
}
