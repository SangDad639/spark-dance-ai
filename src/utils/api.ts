import { ImageAnalysis } from '@/types';

const KIE_API_BASE_URL = 'https://api.kie.ai/api/v1';
const IMAGE_MODEL_ID = 'ideogram/v3-text-to-image';
const VIDEO_MODEL_ID = 'wan/2-5-image-to-video';

export const optimizePromptLength = (prompt: string, maxLength = 5000): string => {
  if (!prompt) {
    return '';
  }

  let optimized = prompt.replace(/\s+/g, ' ').trim();

  if (optimized.length <= maxLength) {
    return optimized;
  }

  // Remove unnecessary filler words and redundant phrases
  const unnecessaryWords = [
    'very', 'really', 'quite', 'extremely', 'incredibly', 'absolutely',
    'completely', 'totally', 'perfectly', 'beautifully', 'stunning',
    'amazing', 'gorgeous', 'wonderful', 'fantastic', 'excellent',
    'professional quality', 'high quality', 'premium quality',
    'detailed', 'high resolution', '4K resolution', 'high-end',
    'flawless', 'perfect', 'pristine'
  ];

  // Remove redundant adjectives
  for (const word of unnecessaryWords) {
    const regex = new RegExp(`\\b${word}\\b,?\\s*`, 'gi');
    optimized = optimized.replace(regex, '');
  }

  // Remove duplicate phrases
  const words = optimized.split(/,\s*/);
  const uniqueWords = [...new Set(words.map(w => w.trim().toLowerCase()))]
    .map(w => words.find(original => original.trim().toLowerCase() === w) || w);

  optimized = uniqueWords.join(', ');

  // Clean up extra spaces and commas
  optimized = optimized
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/,\s*$/, '')
    .trim();

  // If still too long, prioritize most important parts
  if (optimized.length > maxLength) {
    const parts = optimized.split(', ');
    let result = parts[0]; // Keep the base prompt

    for (let i = 1; i < parts.length && result.length + parts[i].length + 2 <= maxLength; i++) {
      result += ', ' + parts[i];
    }

    optimized = result;
  }

  return optimized;
};
interface KieTaskCreateResponse {
  code: number;
  msg: string;
  data?: {
    taskId?: string;
  };
}

interface KieRecordInfoData {
  taskId: string;
  model: string;
  state: string;
  resultJson?: unknown;
  failMsg?: string | null;
}

interface KieRecordInfoResponse {
  code: number;
  msg: string;
  data?: KieRecordInfoData;
}

const createKieTask = async (payload: unknown, apiKey: string): Promise<string> => {
  const response = await fetch(`${KIE_API_BASE_URL}/jobs/createTask`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kie.ai createTask failed: ${errorText || response.statusText}`);
  }

  const json: KieTaskCreateResponse = await response.json();
  const taskId = json.data?.taskId;
  if (json.code !== 200 || !taskId) {
    throw new Error(json.msg || 'Kie.ai createTask returned an unexpected response');
  }

  return taskId;
};

const pollKieTask = async (
  taskId: string,
  apiKey: string,
  {
    intervalMs = 4000,
    timeoutMs,
  }: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<KieRecordInfoData> => {
  const start = Date.now();

  while (true) {
    if (timeoutMs && Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for Kie.ai task to complete');
    }

    const response = await fetch(`${KIE_API_BASE_URL}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kie.ai recordInfo failed: ${errorText || response.statusText}`);
    }

    const json: KieRecordInfoResponse = await response.json();
    const data = json.data;
    if (json.code !== 200 || !data) {
      throw new Error(json.msg || 'Kie.ai recordInfo returned an unexpected response');
    }

    const state = data.state?.toLowerCase?.() ?? data.state;
    if (state === 'success') {
      return data;
    }

    if (state === 'fail') {
      throw new Error(data.failMsg || 'Kie.ai task failed');
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
};

const extractResultUrls = (resultJson: unknown): string[] => {
  if (!resultJson) {
    return [];
  }

  let parsed: unknown = resultJson;
  if (typeof resultJson === 'string' && resultJson.trim()) {
    try {
      parsed = JSON.parse(resultJson);
    } catch {
      return [];
    }
  }

  if (parsed && typeof parsed === 'object') {
    const urls = (parsed as { resultUrls?: unknown }).resultUrls;
    if (Array.isArray(urls)) {
      return urls.filter((url): url is string => typeof url === 'string' && url.length > 0);
    }
  }

  return [];
};

export const analyzeImageWithAI = async (base64Image: string): Promise<ImageAnalysis> => {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

  const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageData: base64Image,
    }),
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

export const generateImageWithKie = async (
  prompts: string[],
  apiKey: string,
  onImageComplete?: (imageUrl: string, index: number) => void,
  onImageFailed?: (error: string, index: number) => void,
  imageSize: string = "portrait_16_9"
): Promise<string[]> => {
  const sanitizedKey = apiKey.trim();
  if (!sanitizedKey) {
    throw new Error('Missing Kie.ai API key');
  }

  const imageUrls: string[] = [];
  const failedAttempts: string[] = [];

  // Generate each image separately with different prompts
  for (let i = 0; i < prompts.length; i++) {
    try {
      const normalizedPrompt = optimizePromptLength(prompts[i], 5000);

      const taskId = await createKieTask(
        {
          model: IMAGE_MODEL_ID,
          input: {
            prompt: normalizedPrompt,
            rendering_speed: "TURBO",
            style: "REALISTIC",
            expand_prompt: true,
            image_size: imageSize,
            num_images: "1",
            sync_mode: false,
            negative_prompt: "blur, distort, low quality, deformed, cartoon, anime, illustration, painting, drawing, sketch, text, watermark, signature, logo"
          },
        },
        sanitizedKey
      );

      const record = await pollKieTask(taskId, sanitizedKey);

      // Check if task failed
      if (record.state === 'fail') {
        const errorMsg = record.failMsg || 'Content flagged or processing error';
        console.warn(`Image generation ${i + 1} failed:`, errorMsg);
        failedAttempts.push(`Image ${i + 1}: ${errorMsg}`);
        onImageFailed?.(errorMsg, i);
        continue; // Skip this image and continue with the next one
      }

      const urls = extractResultUrls(record.resultJson);
      if (urls && urls.length > 0) {
        imageUrls.push(urls[0]);
        onImageComplete?.(urls[0], i); // Notify immediately when image is ready
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Error generating image ${i + 1}:`, error);
      failedAttempts.push(`Image ${i + 1}: ${errorMsg}`);
      onImageFailed?.(errorMsg, i);
      continue; // Continue with the next image even if this one fails
    }
  }

  // Log failed attempts for debugging
  if (failedAttempts.length > 0) {
    console.log('Some images failed to generate:', failedAttempts);
  }

  if (imageUrls.length === 0) {
    throw new Error(`All image generation attempts failed. Failed attempts: ${failedAttempts.join(', ')}`);
  }

  return imageUrls;
};

export const generateVideoWithKie = async (
  imageUrl: string,
  prompt: string,
  apiKey: string,
  options?: { duration?: string; resolution?: string }
): Promise<string> => {
  const sanitizedKey = apiKey.trim();
  if (!sanitizedKey) {
    throw new Error('Missing Kie.ai API key');
  }
  const normalizedPrompt = optimizePromptLength(prompt, 800);

  const duration = options?.duration?.toString().trim() || '5';
  const resolution = options?.resolution?.toString().trim() || '720p';

  const taskId = await createKieTask(
    {
      model: VIDEO_MODEL_ID,
      input: {
        prompt: normalizedPrompt,
        image_url: imageUrl,
        duration,
        resolution,
        negative_prompt: 'blur, distort, low quality, deformed',
        enable_prompt_expansion: false,
      },
    },
    sanitizedKey
  );

  const record = await pollKieTask(taskId, sanitizedKey);
  const [videoUrl] = extractResultUrls(record.resultJson);

  if (!videoUrl) {
    throw new Error('Kie.ai did not return a video URL');
  }

  return videoUrl;
};

export const createDiverseImagePrompts = (basePrompt: string, count: number, analysis?: any): string[] => {
  const environments = [
    "standing in a modern photography studio with gradient backdrop and professional lighting equipment",
    "positioned in an elegant luxury bedroom with silk curtains and soft ambient lighting",
    "located in a contemporary loft space with exposed brick walls and large windows",
    "situated in a minimalist white room with clean lines and bright even lighting",
    "placed in a natural outdoor garden setting with lush greenery and soft daylight",
    "positioned on an urban rooftop terrace with city skyline visible in background",
    "standing in a professional dance studio with mirrored walls and wooden floors",
    "located in an artistic space with colorful backdrop and creative lighting setup",
    "situated by large floor-to-ceiling windows with natural light streaming in",
    "positioned in a beach-side location with ocean waves visible in the background"
  ];

  const poses = [
    "She stands confidently with one hand placed on her hip, shoulders relaxed, looking directly at the camera with a gentle expression",
    "She poses gracefully with both arms extended in a dance-like position, body slightly turned, creating elegant lines",
    "She sits elegantly on a modern chair, legs crossed, hands resting naturally, maintaining perfect posture",
    "She leans casually against a wall or surface, weight shifted to one leg, creating a relaxed confident stance",
    "She is captured mid-stride in a walking pose, one foot forward, arms swinging naturally at her sides",
    "She poses dynamically mid-jump, hair and clothing captured in motion, expressing energy and freedom",
    "She stands with arms crossed over her chest, displaying confidence and strength in her posture",
    "She gently touches her hair with one hand, creating a soft, feminine gesture while looking at the camera",
    "She places both hands on her waist, elbows slightly out, creating a classic modeling pose",
    "She sits in a relaxed position, hands resting on her knees, with a natural comfortable expression"
  ];

  const lightingSetups = [
    "The lighting is soft and even with professional studio setup, avoiding harsh shadows, creating bright clean atmosphere",
    "Natural window light provides soft diffused illumination, creating gentle shadows and warm skin tones",
    "Dramatic side lighting creates depth with controlled shadows, emphasizing facial features and body contours",
    "Golden hour lighting provides warm sunset glow, creating romantic and dreamy atmosphere with soft highlights",
    "Ring light setup provides even facial illumination with characteristic circular catchlights in the eyes",
    "Soft overhead lighting creates beauty photography style with minimal shadows and even skin tone rendering",
    "Backlit rim lighting creates subtle halo effect around hair and body edges, separating subject from background",
    "Colorful LED accent lighting adds vibrant atmosphere while maintaining proper exposure on the subject",
    "Warm candlelight ambiance creates intimate mood with soft flickering light and golden color temperature",
    "Bright daylight photography utilizes natural sun as key light source, creating crisp clear details"
  ];

  const portraitAngles = [
    "shot at eye level with direct eye contact, symmetrical composition, professional headshot style",
    "captured from slightly below looking up, empowering low angle, strong confident perspective",
    "photographed from slightly above looking down, flattering high angle, elegant feminine perspective",
    "shot at three-quarter angle, classic portrait positioning, professional modeling angle",
    "captured with side profile angle, artistic silhouette, dramatic side lighting emphasis",
    "photographed with over-the-shoulder perspective, intimate portrait style, engaging viewer connection",
    "shot with close-up portrait framing, focus on facial features, beauty photography style",
    "captured with medium shot composition, waist-up framing, fashion photography angle",
    "photographed with tilted camera angle, dynamic Dutch tilt, creative artistic perspective",
    "shot with straight-on portrait angle, direct gaze, commercial photography style"
  ];

  const technicalSpecs = [
    "Shot with shallow depth of field, bokeh background, photorealistic style, ultra-HD 8K resolution, portrait orientation",
    "Captured with medium depth of field, sharp focus throughout, high dynamic range, natural color grading with warm tones",
    "Photographed with very shallow depth of field, extreme bokeh, cinematic lighting, desaturated background to emphasize subject",
    "Shot with wide aperture f/1.8, soft background blur, ultra-detailed textures of skin and fabric, cool highlights and warm skin tones",
    "Captured with professional portrait lens 85mm, perfect focus on facial features, high contrast ratio, magazine-quality finish",
    "Photographed with macro detail level, every texture visible, from skin pores to fabric weave, studio-quality lighting",
    "Shot with cinematic composition, rule of thirds, dramatic lighting contrast, film-like color grading and atmosphere",
    "Captured with fashion photography style, high-key lighting, clean background, commercial advertising quality",
    "Photographed with artistic approach, creative composition, unique lighting angle, gallery-worthy presentation",
    "Shot with portrait photography technique, natural lighting, authentic feel, professional execution with vertical framing"
  ];

  const prompts: string[] = [];

  // Create comprehensive preservation clause with all characteristics
  const preservationClause = analysis ?
    `${analysis.ethnicity || ''} ${analysis.age_range || ''} with ${analysis.skin_color || analysis.skin_tone || ''} skin, ${analysis.hair_color || ''} ${analysis.hair || ''}, ${analysis.eye_color || ''} eyes, ${analysis.facial_features || ''} facial features, ${analysis.body_type || ''} ${analysis.body_proportions || ''} figure${analysis.breast_size ? ` with ${analysis.breast_size}` : ''}${analysis.breast_focus ? `, ${analysis.breast_focus}` : ''}, wearing exactly the same ${analysis.clothing}, ${analysis.makeup_style || ''} makeup style, maintaining identical appearance and style` :
    'maintaining exact same ethnicity, skin color, hair color, eye color, facial features, body type, breast size, clothing and all personal characteristics';

  for (let i = 0; i < count; i++) {
    const environment = environments[i % environments.length];
    const pose = poses[i % poses.length];
    const lighting = lightingSetups[i % lightingSetups.length];
    const portraitAngle = portraitAngles[i % portraitAngles.length];
    const technical = technicalSpecs[i % technicalSpecs.length];

    const structuredPrompt = `A hyper-realistic, high-resolution portrait of ${basePrompt}, ${preservationClause}. ${environment}. ${pose}. ${portraitAngle}. ${lighting}. ${technical}. IMPORTANT: keep exact same ethnicity, skin color, hair color, eye color, facial features, body type, breast size, clothing, makeup and all personal characteristics completely unchanged`;
    prompts.push(optimizePromptLength(structuredPrompt, 5000));
  }

  return prompts;
};

export const createVideoPrompt = (analysis: ImageAnalysis): string => {
  // Simple video prompt focusing only on movement
  const movements = [
    'graceful dancing movements, smooth body motion',
    'dynamic dance performance, rhythmic movement',
    'elegant dance choreography, fluid motion',
    'professional dance moves, energetic performance',
    'contemporary dance style, expressive movement'
  ];

  const cameraMovements = [
    'static camera, stable framing',
    'slight camera movement, dynamic angle',
    'smooth camera motion, cinematic style',
    'steady cam, professional filming',
    'fixed perspective, focused composition'
  ];

  const randomMovement = movements[Math.floor(Math.random() * movements.length)];
  const randomCamera = cameraMovements[Math.floor(Math.random() * cameraMovements.length)];

  return `${randomMovement}, ${randomCamera}`;
};

export const createCaption = (analysis: ImageAnalysis): string => {
  return `Amazing Dance Performance!

Watch this stunning dance video
Style focus: ${analysis.sexy_level}
Feel the rhythm and energy
Outfit: ${analysis.clothing}

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
