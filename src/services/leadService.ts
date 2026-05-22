import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

// Helper for exponential backoff retry with jitter
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 6, initialDelay = 4000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message?.toLowerCase() || "";
      const isRateLimit = errorMsg.includes("429") || 
                          errorMsg.includes("resource_exhausted") || 
                          errorMsg.includes("throttled") || 
                          errorMsg.includes("exhausted") ||
                          errorMsg.includes("quota");
      
      if (isRateLimit && i < maxRetries - 1) {
        // Exponential backoff with jitter and increasing base delay
        const baseDelay = initialDelay * Math.pow(2, i);
        const jitter = Math.random() * 2000;
        const delay = baseDelay + jitter;
        console.warn(`Gemini API throttled or quota issue. Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

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
  whatsapp?: string;
  socialMedia: {
    facebook?: string;
    linkedin?: string;
    instagram?: string;
    twitter?: string;
  };
  websiteIssues: string[];
  opportunityScore: number;
  cms: string;
  status: 'New' | 'Contacted' | 'Meeting' | 'Proposal' | 'Won' | 'Lost';
  projectType: string;
  clientManager?: string;
  processingWork?: string;
  details?: string;
  createdAt: string;
  updatedAt: string;
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
    const response = await withRetry(() => ai.models.generateContent({
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
              whatsapp: { type: Type.STRING },
              socialMedia: {
                type: Type.OBJECT,
                properties: {
                  facebook: { type: Type.STRING },
                  linkedin: { type: Type.STRING },
                  instagram: { type: Type.STRING },
                  twitter: { type: Type.STRING },
                }
              },
              websiteIssues: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              opportunityScore: { type: Type.NUMBER },
              cms: { type: Type.STRING },
              projectType: { type: Type.STRING },
              details: { type: Type.STRING }
            },
            required: ["businessName", "websiteUrl", "industry", "email", "websiteIssues", "opportunityScore", "cms", "projectType"]
          }
        },
        tools: [{ googleSearch: {} }]
      }
    }), 5, 5000);

    const leads = JSON.parse(response.text || "[]");
    const now = new Date().toISOString();
    return leads.map((l: any) => ({
      ...l,
      id: Math.random().toString(36).substr(2, 9),
      status: 'New',
      createdAt: now,
      updatedAt: now
    }));
  } catch (error: any) {
    console.error("Error searching leads:", error);
    const errorMsg = error?.message || "Unknown error occurred while searching leads.";
    if (errorMsg.includes("429") || errorMsg.includes("exhausted")) {
      throw new Error("The AI is currently busy (Rate Limit). Please wait a few seconds and try again.");
    }
    throw new Error(errorMsg);
  }
}

export async function generatePitch(lead: Lead): Promise<string> {
  const prompt = `Write a professional, persuasive outreach email for the business "${lead.businessName}". 
  Target URL: ${lead.websiteUrl}
  Industry: ${lead.industry}
  
  Identified Issues to mention:
  ${(lead.websiteIssues || []).join(', ')}
  
  Goal: Offer WordPress redesign, speed optimization, and security hardening services. 
  The tone should be helpful and expert, not pushy. 
  Highlight how these improvements will help their conversion rate and SEO.
  
  Keep it concise and professional.`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    }));
    return response.text || "Failed to generate pitch.";
  } catch (error: any) {
    console.error("Error generating pitch:", error);
    const errorMsg = error?.message || "Unknown error occurred while generating pitch.";
    if (errorMsg.includes("429") || errorMsg.includes("exhausted")) {
      throw new Error("The AI is currently busy. Please wait a few seconds and try again.");
    }
    throw new Error(errorMsg);
  }
}

export interface DemoPromptResult {
  visualAudit: string;
  keyImprovements: string;
  masterPrompt: string;
}

export async function generateFollowUp(lead: Lead, step: number = 1): Promise<string> {
  const sequenceDescription = step === 1 ? "This is the first follow-up (2 days after initial contact)." : 
                         step === 2 ? "This is the second follow-up (5 days after, slightly more urgent)." : 
                         "This is the third and final follow-up (break-up email).";

  const prompt = `Write a professional, non-intrusive follow-up email for the business "${lead.businessName}". 
  Previous Context: We reached out about their website issues (${(lead.websiteIssues || []).join(', ')}).
  
  Current Sequence: ${sequenceDescription}
  
  The goal is to gently remind them of the value of a modern, secure WordPress site and offer a quick 5-minute audit call.
  
  Keep it extremely short, professional, and value-oriented. Use a clean, modern tone.`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    }));
    return response.text || "Failed to generate follow-up.";
  } catch (error: any) {
    console.error("Error generating follow-up:", error);
    const errorMsg = error?.message || "Unknown error occurred while generating follow-up.";
    if (errorMsg.includes("429") || errorMsg.includes("exhausted")) {
      throw new Error("The AI is currently busy. Please wait a few seconds and try again.");
    }
    throw new Error(errorMsg);
  }
}

export async function enrichLeadData(query: string): Promise<Partial<Lead>> {
  const prompt = `Find professional business details for "${query}". 
  Include social media (Facebook, LinkedIn, Instagram, Twitter), CMS, industry, and contact info.
  Return as a clean JSON object matching the Lead interface schema.`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            businessName: { type: Type.STRING },
            websiteUrl: { type: Type.STRING },
            industry: { type: Type.STRING },
            email: { type: Type.STRING },
            phone: { type: Type.STRING },
            whatsapp: { type: Type.STRING },
            socialMedia: {
              type: Type.OBJECT,
              properties: {
                facebook: { type: Type.STRING },
                linkedin: { type: Type.STRING },
                instagram: { type: Type.STRING },
                twitter: { type: Type.STRING },
              }
            },
            cms: { type: Type.STRING },
            projectType: { type: Type.STRING }
          }
        },
        tools: [{ googleSearch: {} }]
      }
    }), 5, 5000);

    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    console.error("Error enriching lead data:", error);
    const errorMsg = error?.message || "Failed to enrich lead data.";
    if (errorMsg.includes("429") || errorMsg.includes("exhausted")) {
      throw new Error("The AI is currently busy. Please wait a few seconds and try again.");
    }
    throw new Error(errorMsg);
  }
}
export async function generateDemoPrompt(lead: Lead): Promise<DemoPromptResult> {
   const prompt = `Role: You are an Advanced AI Web Strategist & Full-Stack Application Architect. 
Your goal is to perform a deep visual and structural audit of "${lead.websiteUrl}" for "${lead.businessName}".

Phase 1: Deep Content & Structure Extraction
- Audit "${lead.websiteUrl}" thoroughly. Identify every core page (Home, About, Services, Contact, Blog, etc.).
- Capture the EXACT hierarchy, page titles, and navigation architecture.
- Extract ALL real text content, service lists, team bios, and contact details from the site. NO LOREM IPSUM.
- Note the brand identity: colors, typography vibe, and key imagery.

Phase 2: Modernization Blueprint
- Design a "Same-to-Same Content" but "Modern-to-Future Design" reconstruction plan.
- Ensure every single page detected is mapped for reconstruction.
- Address these specific site issues found in our audit: ${(lead.websiteIssues || []).join(', ')}.

Phase 3: AI Studio Optimized Master Prompt Generation
- Create a powerful prompt for another AI (Google AI Studio) to build this application.
- DO NOT mention specific plugins (Elementor, Crocoblock, etc.). Focus on core web functionality.
- Focus on building a high-performance, full-stack, responsive web application.

Output Format:
You MUST provide the output in three distinct parts separated by markers.

---VISUAL_AUDIT---
[List all detected pages and a summary of the current design language/content tone]

---KEY_IMPROVEMENTS---
[List specific technical and design improvements, including resolution of: ${(lead.websiteIssues || []).join(', ')}]

---MASTER_PROMPT---
Role: Senior Full-Stack Developer.
Task: Reconstruct and modernize "${lead.websiteUrl}" into a premium web application.

CORE REQUIREMENTS:
1. CONTENT FIDELITY: Use the EXACT real text, service descriptions, and headers from ${lead.websiteUrl}. Every bit of real information must be preserved. Use actual images/services/team info. NO LOREM IPSUM.
2. FULL RECONSTRUCTION: Build ALL pages found on the original site (Home, About, Services, etc.). Replicate the exact sitemap and navigation logic.
3. DESIGN TRANSFORMATION: Transform the current layout into a world-class, ultra-modern, clean, and high-converting aesthetic.
4. AUDIT RESOLUTION: The new build MUST resolve these specific legacy issues: ${(lead.websiteIssues || []).join(', ')}.
5. PERFORMANCE & ACCESSIBILITY: Optimize for 99+ PageSpeed scores, SEO best practices, and pixel-perfect mobile-first responsiveness.
6. OUTPUT: Provide the complete frontend and backend structure for this modern version using the best available web standards.`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    }));
    
    const text = response.text || "";
    
    const visualAudit = text.split("---VISUAL_AUDIT---")[1]?.split("---KEY_IMPROVEMENTS---")[0]?.trim() || "No visual audit data.";
    const keyImprovements = text.split("---KEY_IMPROVEMENTS---")[1]?.split("---MASTER_PROMPT---")[0]?.trim() || "No improvement data.";
    const masterPrompt = text.split("---MASTER_PROMPT---")[1]?.trim() || text.trim();
    
    return {
      visualAudit,
      keyImprovements,
      masterPrompt
    };
  } catch (error: any) {
    console.error("Error generating demo prompt:", error);
    const errorMsg = error?.message || "Unknown error occurred while generating demo prompt.";
    if (errorMsg.includes("429") || errorMsg.includes("exhausted")) {
      throw new Error("The AI is currently busy. Please wait a few seconds and try again.");
    }
    throw new Error(errorMsg);
  }
}
