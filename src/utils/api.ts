import { ImageAnalysis } from '@/types';

export const analyzeImageWithOpenAI = async (base64Image: string, apiKey: string): Promise<ImageAnalysis> => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [{
          type: 'text',
          text: 'ช่วยแกะ Prompt สร้างภาพนี้อย่างละเอียดให้หน่อย ทั้งรูปร่าง หน้าตา อายุ รูปร่าง ความ sexy. กรุณาตอบเป็น JSON format นี้เท่านั้น: {"detailed_prompt": "...", "age_range": "...", "body_type": "...", "facial_features": "...", "sexy_level": "...", "pose": "...", "clothing": "...", "hair": "...", "background": "..."}'
        }, {
          type: 'image_url',
          image_url: { url: base64Image }
        }]
      }],
      max_completion_tokens: 1000
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse JSON from OpenAI response');
  }
  
  return JSON.parse(jsonMatch[0]);
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
  return `Sexy dance performance, ${analysis.age_range} year old woman with ${analysis.body_type} figure, ${analysis.hair}, wearing ${analysis.clothing}, sensual dancing movements, smooth body motion, professional choreography, dynamic dance moves, energetic performance, ${analysis.sexy_level}, rhythmic movement, seductive dance style, elegant motion`;
};

export const createCaption = (analysis: ImageAnalysis): string => {
  return `✨ Amazing Dance Performance! 💃

🔥 Watch this stunning dance video
💫 ${analysis.sexy_level}
🎵 Feel the rhythm and energy
👗 ${analysis.clothing}

#Dance #Performance #Viral #Amazing #Trending #DanceVideo #SexyDance #HotDance #Dancer #DanceLife #ViralVideo #TrendingNow #MustWatch`;
};

export const imageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
