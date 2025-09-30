import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { Upload, X, Sparkles, Loader2 } from 'lucide-react';
import {
  analyzeImageWithOpenAI,
  generateImageWithFal,
  generateVideoWithFal,
  createVideoPrompt,
  createCaption,
  imageToBase64,
} from '@/utils/api';
import { GenerationJob, GeneratedVideo } from '@/types';

export default function Index() {
  const navigate = useNavigate();
  const { apiKeys, setCurrentJob, addJobToHistory } = useAppContext();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoCount, setVideoCount] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    if (!apiKeys?.openai || !apiKeys?.fal) {
      toast({
        title: 'API Keys Required',
        description: 'Please configure your API keys in Settings',
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

    setIsProcessing(true);
    setProgress(0);

    const jobId = `job-${Date.now()}`;
    const job: GenerationJob = {
      id: jobId,
      originalImage: imagePreview!,
      videos: [],
      videoCount,
      status: 'analyzing',
      createdAt: new Date(),
    };

    try {
      // Step 1: Analyze image
      setStatusMessage('Analyzing image with AI...');
      setProgress(10);
      const base64Image = await imageToBase64(selectedImage);
      const analysis = await analyzeImageWithOpenAI(base64Image, apiKeys.openai);
      job.imageAnalysis = analysis;
      setProgress(25);

      // Step 2: Generate new image
      setStatusMessage('Creating enhanced image...');
      const imagePrompt = analysis.detailed_prompt;
      const regeneratedImageUrl = await generateImageWithFal(imagePrompt, apiKeys.fal);
      job.regeneratedImageUrl = regeneratedImageUrl;
      job.status = 'generating-videos';
      setProgress(40);

      // Step 3: Generate videos
      const videoPrompt = createVideoPrompt(analysis);
      const caption = createCaption(analysis);

      for (let i = 0; i < videoCount; i++) {
        setStatusMessage(`Generating video ${i + 1} of ${videoCount}...`);
        const videoUrl = await generateVideoWithFal(regeneratedImageUrl, videoPrompt, apiKeys.fal);
        
        const video: GeneratedVideo = {
          id: `video-${Date.now()}-${i}`,
          videoUrl,
          prompt: videoPrompt,
          caption,
          createdAt: new Date(),
          status: 'completed',
        };

        job.videos.push(video);
        setProgress(40 + ((i + 1) / videoCount) * 55);
      }

      job.status = 'completed';
      setProgress(100);
      setStatusMessage('All videos generated successfully!');

      setCurrentJob(job);
      addJobToHistory(job);

      toast({
        title: 'Success!',
        description: `Generated ${videoCount} video${videoCount !== 1 ? 's' : ''} successfully`,
      });

      // Navigate to results after a short delay
      setTimeout(() => {
        navigate('/results');
      }, 1500);

    } catch (error: any) {
      console.error('Generation error:', error);
      job.status = 'failed';
      job.error = error.message;
      
      toast({
        title: 'Generation Failed',
        description: error.message || 'An error occurred during generation',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
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
                  disabled={isProcessing}
                />
              </div>

              {/* Progress */}
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-white text-sm">
                    <span>{statusMessage}</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={handleGenerate}
                  disabled={!selectedImage || isProcessing}
                  className="flex-1"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Generate Videos
                    </>
                  )}
                </Button>
                {selectedImage && !isProcessing && (
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
