import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { GoogleGenAI } from "npm:@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    const ai = new GoogleGenAI({ apiKey });

    // 1. Fetch all active spaces
    const { data: spaces, error: spacesError } = await supabaseClient
      .from("spaces")
      .select("id, users")
      .eq("is_active", true);

    if (spacesError || !spaces) throw spacesError;

    const today = new Date().toISOString().split("T")[0];

    // Process all spaces concurrently
    const results = await Promise.allSettled(
      spaces.map(async (space) => {
        // Check if question already exists
        const { data: existing } = await supabaseClient
          .from("dynamic_questions")
          .select("id")
          .eq("space_id", space.id)
          .eq("date", today)
          .single();

        if (existing) return; // Already generated

        // Fetch energy logs for today
        const { data: logs } = await supabaseClient
          .from("energy_logs")
          .select("user_id, morning_level, night_level")
          .eq("space_id", space.id)
          .eq("date", today);

        const userA = space.users[0];
        const userB = space.users[1];

        const logA = logs?.find((l) => l.user_id === userA);
        const logB = logs?.find((l) => l.user_id === userB);

        // Average their energy levels if possible
        const getEnergy = (log: any) => {
          if (!log) return null;
          let sum = 0;
          let count = 0;
          if (log.morning_level) { sum += log.morning_level; count++; }
          if (log.night_level) { sum += log.night_level; count++; }
          return count > 0 ? sum / count : null;
        };

        const energyA = getEnergy(logA);
        const energyB = getEnergy(logB);

        const prompt = `
You are a brilliant, unpredictable relationship psychologist and conversational provocateur. Your job is to generate exactly ONE highly specific, engaging daily question for a couple. 

Current Context:
- User A's energy today: ${energyA || "Not logged"}/5
- User B's energy today: ${energyB || "Not logged"}/5

INSTRUCTIONS:
1. Calibrate to the Energy:
   - If BOTH are Low (1-2) or Missing: Keep it soft, nostalgic, or comforting. No heavy psychological lifting. Provide a gentle opening.
   - If BOTH are High (4-5): Make it intense, spicy, hypothetical, or highly adventurous. 
   - If MIXED: Focus on curiosity, perception, and empathy. Bridge the gap between their states.

2. Thematic Angles (Randomly choose one):
   - THE UNTOLD: Ask about a secret thought, a silent struggle, or an unvoiced desire they hold.
   - THE MIRROR: Ask them to describe how they perceive a specific quirk, flaw, or beautiful trait in the other person.
   - THE SCENARIO: Create a highly specific, high-stakes hypothetical situation that forces a revealing choice.
   - THE TENSION: Ask a flirty, provocative question about physical attraction or romantic tension.

3. STRICT UNBREAKABLE RULES:
   - BAN CLICHÉS: You are FORBIDDEN from asking generic questions like "What is your favorite memory of us?", "What are you grateful for?", or "How can I support you?"
   - FORCE SPECIFICITY: Ask about a specific *moment*, *sensation*, or *realization*. (e.g., instead of "When were you happy?", ask "When was the exact second you realized I was completely obsessed with you?")
   - NO YES/NO: The question must require a story, a confession, or a debate.
   - FORMAT: Return ONLY the question. No quotes, no intro, no emojis. Just the raw, punchy text.
`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        let questionText = response.text?.trim() || "";
        
        // Ensure no quotes
        questionText = questionText.replace(/^["']|["']$/g, '');

        if (!questionText) throw new Error("AI returned empty response");

        // Insert
        await supabaseClient.from("dynamic_questions").insert({
          space_id: space.id,
          date: today,
          question_text: questionText,
        });
      })
    );

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
