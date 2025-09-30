export interface ApiKeys {
  openai: string;
  fal: string;
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
  background: string;
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
  regeneratedImageUrl?: string;
  videos: GeneratedVideo[];
  videoCount: number;
  status: 'analyzing' | 'generating-image' | 'generating-videos' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
}
