export interface ApiKeys {
  openai: string;
  kie: string;
  n8nWebhook?: string;
  googleDriveFolderId?: string;
  facebookPageId?: string;
  facebookAccessToken?: string;
}

export interface ImageAnalysis {
  detailed_prompt: string;
  age_range: string;
  body_type: string;
  facial_features: string;
  sexy_level: string;
  pose: string;
  clothing: string;
  hair: string;
  hair_color: string;
  background: string;
  ethnicity: string;
  skin_color: string;
  skin_tone: string;
  breast_size: string;
  breast_focus: string;
  eye_color: string;
  makeup_style: string;
  body_proportions: string;
}

export interface GeneratedVideo {
  id: string;
  videoUrl: string;
  thumbnail?: string;
  prompt: string;
  caption: string;
  createdAt: Date;
  status: 'processing' | 'completed' | 'failed';
}

export interface GenerationJob {
  id: string;
  originalImage: string;
  imageAnalysis?: ImageAnalysis;
  regeneratedImageUrls?: string[];
  selectedImageUrls?: string[];
  imagePrompt?: string;
  videoPrompt?: string;
  videos: GeneratedVideo[];
  videoCount: number;
  status: 'analyzing' | 'generating-image' | 'image-ready' | 'generating-videos' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
}
