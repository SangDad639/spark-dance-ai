import { ImageAnalysis } from '@/types';

export const analyzeImageWithAI = async (base64Image: string): Promise<ImageAnalysis> => {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageData: base64Image
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    }
    
    if (response.status === 402) {
      throw new Error('AI credits exhausted. Please add credits to continue using this feature.');
    }
    
    throw new Error(error.error || 'Failed to analyze image');
  }

  return await response.json();
};

export const generateImageWithFal = async (prompt: string, falKey: string): Promise<string> => {
  const response = await fetch('https://fal.run/fal-ai/recraft/v3/text-to-image', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      image_size: 'portrait_16_9',
      style: 'realistic_image'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`FAL.AI Recraft error: ${error}`);
  }

  const data = await response.json();
  return data.images[0].url;
};

export const generateVideoWithFal = async (
  imageUrl: string, 
  prompt: string, 
  falKey: string
): Promise<string> => {
  const response = await fetch('https://fal.run/fal-ai/kling-video/v2.1/standard/image-to-video', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      image_url: imageUrl,
      duration: '10',
      aspect_ratio: '9:16',
      negative_prompt: 'blur, distort, low quality, deformed',
      cfg_scale: 0.5
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`FAL.AI Kling error: ${error}`);
  }

  const data = await response.json();
  return data.video.url;
};

export const createVideoPrompt = (analysis: ImageAnalysis): string => {
  return `Professional dance performance, ${analysis.age_range} year old performer with ${analysis.body_type} figure, ${analysis.hair}, wearing ${analysis.clothing}, graceful dancing movements, smooth body motion, professional choreography, dynamic dance moves, energetic performance, ${analysis.sexy_level} style, rhythmic movement, elegant dance style, fluid motion`;
};

export const createCaption = (analysis: ImageAnalysis): string => {
  return `✨ Amazing Dance Performance! 💃

🔥 Watch this stunning dance video
💫 ${analysis.sexy_level} style
🎵 Feel the rhythm and energy
👗 ${analysis.clothing}

#Dance #Performance #Viral #Amazing #Trending #DanceVideo #DancePerformance #Dancer #DanceLife #ViralVideo #TrendingNow #MustWatch`;
};

export const imageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
