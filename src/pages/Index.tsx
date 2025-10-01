import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { Upload, X, Sparkles, Loader2 } from 'lucide-react';
import {
  analyzeImageWithAI,
  generateImageWithKie,
  generateVideoWithKie,
  createVideoPrompt,
  createCaption,
  imageToBase64,
  optimizePromptLength,
} from '@/utils/api';
import { GenerationJob, GeneratedVideo } from '@/types';

export default function Index() {
  const navigate = useNavigate();
  const { apiKeys, currentJob, setCurrentJob, addJobToHistory } = useAppContext();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoCount, setVideoCount] = useState<number>(1);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingVideos, setIsGeneratingVideos] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [currentPrompts, setCurrentPrompts] = useState<{ image?: string; video?: string }>({});
  const [videoDuration, setVideoDuration] = useState('5');
  const [videoResolution, setVideoResolution] = useState('720p');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetProgressState = () => {
    setProgress(0);
    setStatusMessage('');
    setIsGeneratingImage(false);
    setIsGeneratingVideos(false);
  };

  const handleImageSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Please select an image smaller than 10MB',
        variant: 'destructive',
      });
      return;
    }

    setSelectedImage(file);
    setCurrentPrompts({});
    setCurrentJob(null);
    resetProgressState();

    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageSelect(file);
    }
  };

  const handleClear = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setVideoCount(1);
    setCurrentPrompts({});
    setCurrentJob(null);
    setIsGeneratingImage(false);
    setIsGeneratingVideos(false);
    resetProgressState();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerateImage = async () => {
    if (!apiKeys?.kie) {
      toast({
        title: 'Kie.ai API Key Required',
        description: 'Please configure your Kie.ai API key in Settings',
        variant: 'destructive',
      });
      navigate('/settings');
      return;
    }

    if (!selectedImage) {
      toast({
        title: 'No Image Selected',
        description: 'Please upload an image first',
        variant: 'destructive',
      });
      return;
    }

    setCurrentPrompts({});
    setIsGeneratingImage(true);
    setProgress(0);
    setStatusMessage('Analyzing image with AI...');

    try {
      const base64Image = await imageToBase64(selectedImage);
      if (!imagePreview) {
        setImagePreview(base64Image);
      }

      const analysis = await analyzeImageWithAI(base64Image);
      setProgress(25);

      const imagePrompt = optimizePromptLength(analysis.detailed_prompt, 800);
      setCurrentPrompts((prev) => ({ ...prev, image: imagePrompt }));

      setStatusMessage('Creating enhanced image...');
      const regeneratedImageUrls = await generateImageWithKie([imagePrompt], apiKeys.kie);
      const regeneratedImageUrl = regeneratedImageUrls[0];
      setProgress(70);

      const rawVideoPrompt = createVideoPrompt(analysis);
      const videoPrompt = optimizePromptLength(rawVideoPrompt, 800);
      setCurrentPrompts((prev) => ({ ...prev, image: imagePrompt, video: videoPrompt }));

      const job: GenerationJob = currentJob
        ? {
            ...currentJob,
            videos: [],
            videoCount,
            status: 'image-ready',
          }
        : {
            id: `job-${Date.now()}`,
            originalImage: imagePreview ?? base64Image,
            videos: [],
            videoCount,
            status: 'image-ready',
            createdAt: new Date(),
          };

      job.originalImage = imagePreview ?? base64Image;
      job.imageAnalysis = analysis;
      job.imagePrompt = imagePrompt;
      job.videoPrompt = videoPrompt;
      job.regeneratedImageUrl = regeneratedImageUrl;
      job.videos = [];
      job.status = 'image-ready';
      delete job.error;

      setCurrentJob(job);
      setStatusMessage('Image generated. Review the result before creating videos.');
      setProgress(100);
    } catch (error: any) {
      console.error('Image generation error:', error);
      toast({
        title: 'Image Generation Failed',
        description: error.message || 'An error occurred while generating the image',
        variant: 'destructive',
      });
      resetProgressState();
    } finally {
      setIsGeneratingImage(false);
      setProgress(0);
      setTimeout(() => setStatusMessage(''), 1500);
    }
  };

  const handleGenerateVideos = async () => {
    if (!apiKeys?.kie) {
      toast({
        title: 'Kie.ai API Key Required',
        description: 'Please configure your Kie.ai API key in Settings',
        variant: 'destructive',
      });
      navigate('/settings');
      return;
    }

    if (!currentJob?.regeneratedImageUrl || !currentJob.videoPrompt) {
      toast({
        title: 'Image Review Required',
        description: 'Please generate and review the image before creating videos.',
        variant: 'destructive',
      });
      return;
    }

    if (!currentJob.imageAnalysis) {
      toast({
        title: 'Missing Analysis',
        description: 'Image analysis data was not found. Please generate the image again.',
        variant: 'destructive',
      });
      return;
    }

    const analysis = currentJob.imageAnalysis;
    const caption = createCaption(analysis);

    const job: GenerationJob = {
      ...currentJob,
      videos: [],
      videoCount,
      status: 'generating-videos',
      error: undefined,
    };

    setCurrentJob(job);
    setIsGeneratingVideos(true);
    setProgress(0);
    setStatusMessage('Starting video generation...');

    try {
      for (let i = 0; i < videoCount; i++) {
        setStatusMessage(`Generating video ${i + 1} of ${videoCount}...`);

        const videoUrl = await generateVideoWithKie(
          job.regeneratedImageUrl!,
          job.videoPrompt!,
          apiKeys.kie,
          { duration: videoDuration, resolution: videoResolution }
        );

        const video: GeneratedVideo = {
          id: `video-${Date.now()}-${i}`,
          videoUrl,
          prompt: job.videoPrompt!,
          caption,
          createdAt: new Date(),
          status: 'completed',
        };

        job.videos = [...job.videos, video];
        setProgress(Math.round(((i + 1) / videoCount) * 90) + 10);
        setCurrentJob({ ...job });
      }

      job.status = 'completed';
      job.videoCount = videoCount;
      setCurrentJob(job);
      addJobToHistory(job);

      toast({
        title: 'Success!',
        description: `Generated ${videoCount} video${videoCount !== 1 ? 's' : ''} successfully`,
      });

      setStatusMessage('Videos generated successfully!');
      setProgress(100);
      setTimeout(() => navigate('/results'), 1500);
    } catch (error: any) {
      console.error('Video generation error:', error);
      job.status = 'failed';
      job.error = error.message;
      setCurrentJob(job);

      toast({
        title: 'Video Generation Failed',
        description: error.message || 'An error occurred while generating the videos',
        variant: 'destructive',
      });

      resetProgressState();
    } finally {
      setIsGeneratingVideos(false);
      setTimeout(() => setStatusMessage(''), 1500);
      setProgress(0);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardContent className="pt-6">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-white mb-2">AI Dance Video Generator</h1>
              <p className="text-white/70">Upload an image and create stunning dance videos</p>
            </div>

            <div className="space-y-6">
              {/* Upload Area */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-white/30 rounded-lg p-8 text-center hover:border-white/50 transition-colors cursor-pointer bg-white/5"
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-96 mx-auto rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClear();
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="w-16 h-16 mx-auto text-white/50" />
                    <div>
                      <p className="text-white font-medium">Click to upload or drag and drop</p>
                      <p className="text-white/50 text-sm">PNG, JPG, WEBP (max 10MB)</p>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                  className="hidden"
                />
              </div>

              {/* Video Count */}
              <div className="space-y-2">
                <Label htmlFor="videoCount" className="text-white">
                  Number of Videos to Generate (1-10)
                </Label>
                <Input
                  id="videoCount"
                  type="number"
                  min="1"
                  max="10"
                  value={videoCount}
                  onChange={(e) => setVideoCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                  className="bg-white/5 border-white/20 text-white"
                  disabled={isGeneratingImage || isGeneratingVideos}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="videoDuration" className="text-white">
                    Video Duration (seconds)
                  </Label>
                  <Input
                    id="videoDuration"
                    type="number"
                    min="1"
                    max="10"
                    step="1"
                    value={videoDuration}
                    onChange={(e) => {
                      const value = Math.max(1, Math.min(10, parseInt(e.target.value || '0', 10) || 1));
                      setVideoDuration(value.toString());
                    }}
                    className="bg-white/5 border-white/20 text-white"
                    disabled={isGeneratingImage || isGeneratingVideos}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="videoResolution" className="text-white">
                    Video Resolution
                  </Label>
                  <select
                    id="videoResolution"
                    value={videoResolution}
                    onChange={(e) => setVideoResolution(e.target.value)}
                    className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/40"
                    disabled={isGeneratingImage || isGeneratingVideos}
                  >
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                  </select>
                </div>
              </div>

              {/* Progress */}
              {(isGeneratingImage || isGeneratingVideos) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-white text-sm">
                    <span>{statusMessage}</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {currentJob?.regeneratedImageUrl && (
                <div className="space-y-2">
                  <Label className="text-white">Generated Image Preview</Label>
                  <img
                    src={currentJob.regeneratedImageUrl}
                    alt="Generated image preview"
                    className="w-full max-h-96 rounded-lg border border-white/10 bg-black/20 object-contain"
                  />
                </div>
              )}

              {(currentPrompts.image || currentPrompts.video) && (
                <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
                  <h3 className="text-white font-semibold text-sm">Prompts Used</h3>
                  {currentPrompts.image && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-white/60">
                        <span>Image Prompt</span>
                        <span>{currentPrompts.image.length}/800</span>
                      </div>
                      <Textarea
                        value={currentPrompts.image}
                        readOnly
                        rows={4}
                        className="bg-white/5 border-white/15 text-white text-sm resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  )}
                  {currentPrompts.video && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-white/60">
                        <span>Video Prompt</span>
                        <span>{currentPrompts.video.length}/800</span>
                      </div>
                      <Textarea
                        value={currentPrompts.video}
                        readOnly
                        rows={4}
                        className="bg-white/5 border-white/15 text-white text-sm resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleGenerateImage}
                  disabled={!selectedImage || isGeneratingImage || isGeneratingVideos}
                  className="flex-1 min-w-[180px]"
                  size="lg"
                >
                  {isGeneratingImage ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing Image...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Generate Image
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleGenerateVideos}
                  disabled={!currentJob?.regeneratedImageUrl || !currentJob?.videoPrompt || isGeneratingImage || isGeneratingVideos}
                  className="flex-1 min-w-[180px]"
                  size="lg"
                >
                  {isGeneratingVideos ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Generating Videos...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Generate Videos
                    </>
                  )}
                </Button>
                {selectedImage && !isGeneratingImage && !isGeneratingVideos && (
                  <Button onClick={handleClear} variant="outline" size="lg" className="text-white border-white/20 hover:bg-white/10">
                    <X className="w-5 h-5 mr-2" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}









