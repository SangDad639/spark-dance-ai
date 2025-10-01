import { ImageAnalysis } from '@/types';

const KIE_API_BASE_URL = 'https://api.kie.ai/api/v1';
const IMAGE_MODEL_ID = 'bytedance/seedream-v4-text-to-image';
const VIDEO_MODEL_ID = 'wan/2-5-image-to-video';

export const clampPromptLength = (prompt: string, maxLength = 800): string => {
  if (!prompt) {
    return '';
  }

  const normalized = prompt.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const sliceLength = Math.max(0, maxLength - 3);
  const truncated = normalized.slice(0, sliceLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const safe = lastSpace > sliceLength - 40 ? truncated.slice(0, lastSpace) : truncated;
  return `${safe.trim()}...`;
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
    timeoutMs = 240000,
  }: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<KieRecordInfoData> => {
  const start = Date.now();

  while (true) {
    if (Date.now() - start > timeoutMs) {
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

export const generateImageWithKie = async (prompt: string, apiKey: string): Promise<string> => {
  const sanitizedKey = apiKey.trim();
  if (!sanitizedKey) {
    throw new Error('Missing Kie.ai API key');
  }
  const normalizedPrompt = clampPromptLength(prompt, 800);

  const taskId = await createKieTask(
    {
      model: IMAGE_MODEL_ID,
      input: {
        prompt: normalizedPrompt,
        image_size: 'portrait_16_9',
        image_resolution: '1K',
        max_images: 1,
      },
    },
    sanitizedKey
  );

  const record = await pollKieTask(taskId, sanitizedKey, { timeoutMs: 180000 });
  const [imageUrl] = extractResultUrls(record.resultJson);

  if (!imageUrl) {
    throw new Error('Kie.ai did not return an image URL');
  }

  return imageUrl;
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
  const normalizedPrompt = clampPromptLength(prompt, 800);

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

  const record = await pollKieTask(taskId, sanitizedKey, { timeoutMs: 360000 });
  const [videoUrl] = extractResultUrls(record.resultJson);

  if (!videoUrl) {
    throw new Error('Kie.ai did not return a video URL');
  }

  return videoUrl;
};

export const createVideoPrompt = (analysis: ImageAnalysis): string => {
  return `Professional dance performance, ${analysis.age_range} year old performer with ${analysis.body_type} figure, ${analysis.hair}, wearing ${analysis.clothing}, graceful dancing movements, smooth body motion, professional choreography, dynamic dance moves, energetic performance, ${analysis.sexy_level} style, rhythmic movement, elegant dance style, fluid motion`;
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
