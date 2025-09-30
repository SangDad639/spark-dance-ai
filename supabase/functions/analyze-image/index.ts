import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageData } = await req.json();
    console.log('Received image analysis request');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Use Lovable AI Gateway with Gemini model (free and better content policies)
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: [{
            type: 'text',
            text: 'Please analyze this image in detail and provide information about the person\'s appearance, style, and characteristics for creating a dance video. Return your response as a JSON object with these fields: detailed_prompt (detailed description for image generation), age_range (approximate age), body_type (body shape description), facial_features (face description), style_level (attractiveness/elegance level), pose (body position), clothing (outfit description), hair (hairstyle description), background (background description). Focus on artistic and aesthetic details suitable for professional dance performance. Be descriptive but respectful and professional.'
          }, {
            type: 'image_url',
            image_url: { url: imageData }
          }]
        }],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Lovable AI error: ${errorText}`);
    }

    const data = await response.json();
    console.log('Lovable AI response received');
    
    const content = data.choices[0].message.content;
    
    // Parse JSON response
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('AI returned invalid JSON format');
    }

    // Map to expected format (handling both old and new field names)
    const result = {
      detailed_prompt: analysis.detailed_prompt || '',
      age_range: analysis.age_range || 'adult',
      body_type: analysis.body_type || 'average',
      facial_features: analysis.facial_features || '',
      sexy_level: analysis.style_level || analysis.sexy_level || 'elegant',
      pose: analysis.pose || '',
      clothing: analysis.clothing || '',
      hair: analysis.hair || '',
      background: analysis.background || ''
    };

    console.log('Analysis complete');
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-image function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to analyze image';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});