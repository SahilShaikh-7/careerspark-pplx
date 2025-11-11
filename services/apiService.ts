import { Job, Skill } from '../types';

// Perplexity AI Configuration
const PPLX_API_KEY = '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';
const PPLX_API_URL = 'https://api.perplexity.ai/chat/completions';

/**
 * Extracts a JSON object or array from a string using a regular expression.
 * It can handle JSON wrapped in markdown code fences (```json ... ```) or raw JSON.
 * @param text The text which may contain a JSON string.
 * @returns The extracted JSON string, or null if not found.
 */
const extractJson = (text: string): string | null => {
    const jsonRegex = /```json\s*([\s\S]*?)\s*```|({[\s\S]*}|\[[\s\S]*\])/;
    const match = text.match(jsonRegex);

    if (match) {
        // If the markdown group is captured, use it; otherwise, use the direct JSON object/array group.
        return match[1] || match[2];
    }
    
    return null;
};

/**
 * Attempts to repair common JSON errors (like trailing commas) and then parses the string.
 * @param jsonString The potentially malformed JSON string.
 * @returns The parsed JavaScript object.
 * @throws An error if parsing fails even after repair attempts.
 */
const repairAndParseJson = (jsonString: string) => {
    // Attempt to fix trailing commas in objects and arrays, which is a common LLM error.
    const repairedString = jsonString
        .replace(/,\s*([}\]])/g, '$1'); // Removes trailing commas before '}' or ']'

    try {
        return JSON.parse(repairedString);
    } catch (e) {
        // If it still fails, log the original and repaired strings for debugging.
        console.error("Failed to parse JSON even after repair.", {
            original: jsonString,
            repaired: repairedString,
            error: e,
        });
        // Re-throw the original error to be caught by the calling function.
        throw new Error("The AI model returned an invalid JSON format that could not be repaired.");
    }
};


/**
 * Maps the detailed analysis from the AI into the format expected by the application's frontend.
 * @param apiData The raw JSON data from the Perplexity API.
 * @returns An object structured for the application's components.
 */
const mapApiDataToAppFormat = (apiData: any) => {
    const skills: Skill[] = [];
    const skillStrengthToConfidence = (strength: number = 7) => Math.min(Math.max(strength / 10.0, 0), 1);

    const processSkills = (skillNames: string[], category: 'technical' | 'soft' | 'domain') => {
        if (Array.isArray(skillNames)) {
            skillNames.forEach(name => {
                const strength = apiData.skill_meter?.[name];
                skills.push({ name, category, confidence: skillStrengthToConfidence(strength) });
            });
        }
    };

    processSkills(apiData.skills?.technical, 'technical');
    processSkills(apiData.skills?.tools, 'technical');
    processSkills(apiData.skills?.languages, 'technical');
    processSkills(apiData.skills?.soft, 'soft');
    processSkills(apiData.skills?.domain, 'domain');
    
    const feedback: string[] = [];
    if (apiData.feedback) {
        Object.values(apiData.feedback).forEach(fb => {
            if (typeof fb === 'string' && fb) feedback.push(fb);
        });
    }
    if (Array.isArray(apiData.improvement_suggestions)) {
        apiData.improvement_suggestions.forEach((sug: string) => {
            if (sug) feedback.push(sug);
        });
    }

    return {
        score: Number(apiData.overall_score) || 0,
        experience_level: apiData.experience_level || 'Not specified',
        total_experience: Number(apiData.total_experience) || 0,
        feedback,
        skills,
        job_titles: apiData.job_titles || [],
    };
};


/**
 * Analyzes a resume from a public URL using the Perplexity API.
 * @param fileUrl The public URL of the resume file.
 * @returns An object containing the analysis data or an error.
 */
export const analyzeResume = async (fileUrl: string) => {
  try {
    const prompt = `You are a professional resume analyst with 20 years of experience in technical recruiting. Your analysis must be meticulous, accurate, and strictly based on the provided document.

Analyze the resume available at the following URL and provide a structured, detailed JSON response.
RESUME URL: ${fileUrl}

TASKS:
1.  **Identify and extract all skills (explicit and implied).**
2.  **Classify the skills** into the following categories:
    *   \`technical\`: General technical concepts (e.g., 'Data Structures', 'CI/CD').
    *   \`tools\`: Specific software, frameworks, or libraries (e.g., 'React', 'Docker', 'Jira').
    *   \`languages\`: Programming languages (e.g., 'Python', 'JavaScript', 'SQL').
    *   \`soft\`: Interpersonal attributes (e.g., 'Communication', 'Teamwork').
    *   \`domain\`: Industry-specific knowledge (e.g., 'E-commerce', 'Healthcare IT').
3.  **Assign a Skill Strength Score (0–10)** for each skill based on its context and emphasis in the resume. A skill demonstrated in a project should have a higher score than one simply listed.
4.  **Evaluate the resume sections** (Summary, Experience, Projects, Skills) and provide one concise, actionable feedback point for each.
5.  **Suggest the top 3 most impactful improvements** to enhance professional impact and readability.
6.  **Determine the candidate's professional profile:**
    *   Calculate the total years of professional experience.
    *   Categorize the experience level ('Entry-Level', 'Mid-Level', 'Senior').
    *   Suggest up to 3 suitable job titles.
7.  **Provide an overall score (0-100)** based on clarity, technical depth, and presentation.

**STRICT JSON OUTPUT FORMAT:**
Your entire response MUST be a single, valid JSON object. Do not add any text, explanations, or markdown fences before or after the JSON.

{
  "skills": {
    "technical": ["<string>", ...],
    "tools": ["<string>", ...],
    "languages": ["<string>", ...],
    "soft": ["<string>", ...],
    "domain": ["<string>", ...]
  },
  "skill_meter": {
    "<skill_name>": <number, 0-10>,
    ...
  },
  "feedback": {
    "summary": "<string>",
    "experience": "<string>",
    "projects": "<string>",
    "skills": "<string>",
    "overall": "<string, a summary of overall impression>"
  },
  "improvement_suggestions": [
    "<string>",
    "<string>",
    "<string>"
  ],
  "experience_level": "<string, 'Entry-Level', 'Mid-Level', 'Senior', or 'Executive'>",
  "total_experience": <number>,
  "job_titles": ["<string>", "<string>", "<string>"],
  "overall_score": <number, 0-100>
}`;

    const response = await fetch(PPLX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PPLX_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: "You are an API that responds ONLY with a single, valid JSON object based on the user's instructions. You never provide any commentary, explanations, or text outside of the JSON structure requested. Your output must be machine-parsable." },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(`Perplexity API error: ${errorBody.error?.message || response.statusText}`);
    }

    const result = await response.json();
    const rawContent = result.choices[0].message.content;
    
    const jsonString = extractJson(rawContent);
    if (!jsonString) {
        console.error("Failed to extract JSON from model response for resume analysis:", rawContent);
        throw new Error("The AI model returned an invalid format for the resume analysis.");
    }

    const rawData = repairAndParseJson(jsonString);
    const data = mapApiDataToAppFormat(rawData);

    return { data, error: null };
  } catch (error: any) {
    console.error("Error analyzing resume with Perplexity:", error);
    return { data: null, error: error.message || 'An unknown error occurred during resume analysis.' };
  }
};

/**
 * Finds matching job listings using Perplexity API based on detailed resume analysis.
 * @param jobTitles An array of target job titles.
 * @param skills An array of the candidate's skills.
 * @param experienceLevel The candidate's experience level.
 * @returns A promise that resolves to an array of Job objects.
 */
export const findMatchingJobs = async (jobTitles: string[], skills: Skill[], experienceLevel: string): Promise<Job[]> => {
    if (!jobTitles || jobTitles.length === 0) {
        return [];
    }
    try {
        const keySkills = skills.filter(s => s.confidence > 0.8).map(s => s.name).join(', ');
        const prompt = `You are an expert career placement agent AI. Your goal is to find highly relevant job postings based on the provided candidate profile. Prioritize RELEVANCE over quantity.

**CANDIDATE PROFILE:**
*   **Target Job Titles:** [${jobTitles.join(', ')}]
*   **Candidate's Key Skills:** [${keySkills}]
*   **Candidate's Experience Level:** "${experienceLevel}"

**TASK:**
Perform an extensive live web search to find a minimum of 20 real job openings in India. Source these jobs from reputable platforms like LinkedIn, Naukri.com, and directly from company career pages.

**CRITICAL MATCHING & FILTERING RULES:**
1.  **EXPERIENCE IS KEY:** Heavily prioritize jobs that match the candidate's experience level. DISCARD any job where the required experience is wildly mismatched (e.g., a "Director" role for an "Entry-Level" candidate).
2.  **NUANCED MATCH SCORE:** For each job, you MUST calculate a \`match_percentage\` from 70-100 based on this formula:
    *   **Title/Description Alignment (60% weight):** How well does the job posting align with the target titles?
    *   **Skill Overlap (30% weight):** How many of the candidate's key skills are mentioned in the job requirements?
    *   **Experience Fit (10% weight):** Does the job's required experience align with the candidate's level?
    *   **Reputation Bonus (up to 5%):** Add a small bonus for jobs at well-known, reputable companies.
3.  **DIVERSE LEVELS:** The final list must include a mix of experience levels, from roles matching the candidate's current level to slightly more senior positions.

**REQUIRED JSON OUTPUT:**
Respond with a single, valid JSON array of job objects. Each object must strictly follow this structure: 
{ 
  "title": string, 
  "company": string, 
  "location": string, 
  "match_percentage": number, 
  "apply_url": string (a direct, real URL to the application page), 
  "description": string (a 1-2 sentence summary of the role), 
  "salary_range": string, 
  "experience_required": string, 
  "job_type": string 
}.`;

        const response = await fetch(PPLX_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${PPLX_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'sonar-pro',
            messages: [
              { role: 'system', content: 'You are a powerful job search engine API. Your sole purpose is to find real job listings from the web and return them as a single, valid JSON array. Do not include any other text.' },
              { role: 'user', content: prompt },
            ],
          }),
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`Perplexity API error: ${errorBody.error?.message || response.statusText}`);
        }

        const result = await response.json();
        const rawContent = result.choices[0].message.content;

        const jsonString = extractJson(rawContent);
        if (!jsonString) {
          console.error("Failed to extract JSON from model response for jobs:", rawContent);
          throw new Error("The AI model returned an invalid format for job listings.");
        }
        
        const matchedJobs: Job[] = repairAndParseJson(jsonString);
        return matchedJobs;

    } catch (error) {
        console.error("Error finding matching jobs with Perplexity:", error);
        return []; // Return an empty array on error to prevent breaking the UI
    }
};
