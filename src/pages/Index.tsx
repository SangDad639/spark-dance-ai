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
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Upload, X, Sparkles, Loader2, Eye } from 'lucide-react';
import {
  analyzeImageWithAI,
  generateImageWithKie,
  generateVideoWithKie,
  createVideoPrompt,
  createCaption,
  imageToBase64,
  optimizePromptLength,
  createDiverseImagePrompts,
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
  const [imageRatio, setImageRatio] = useState('portrait_16_9');
  const [imageCount, setImageCount] = useState(5);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImageIndices, setSelectedImageIndices] = useState<number[]>([]);
  const [imageSlots, setImageSlots] = useState<Array<{url?: string, loading: boolean, error?: string}>>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetProgressState = () => {
    setProgress(0);
    setStatusMessage('');
    setIsGeneratingImage(false);
    setIsGeneratingVideos(false);
  };

  const openImagePreview = (index: number) => {
    setPreviewImageIndex(index);
    setIsPreviewOpen(true);
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
    setImageCount(5);
    setCurrentPrompts({});
    setCurrentJob(null);
    setGeneratedImages([]);
    setSelectedImageIndices([]);
    setImageSlots([]);
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
    setGeneratedImages([]);
    setSelectedImageIndices([]);
    setImageSlots(Array(imageCount).fill(null).map(() => ({ loading: true })));
    setIsGeneratingImage(true);
    setProgress(0);
    setStatusMessage('Analyzing image with AI...');

    try {
      const base64Image = await imageToBase64(selectedImage);
      if (!imagePreview) {
        setImagePreview(base64Image);
      }

      const analysis = await analyzeImageWithAI(base64Image);
      setProgress(15);

      const imagePrompt = optimizePromptLength(analysis.detailed_prompt, 800);
      setCurrentPrompts((prev) => ({ ...prev, image: imagePrompt }));

      setStatusMessage('Creating diverse image prompts...');
      const diversePrompts = createDiverseImagePrompts(imagePrompt, imageCount, analysis);
      setProgress(25);

      setStatusMessage(`Generating ${imageCount} different images...`);
      const imageUrls: string[] = [];

      const onImageComplete = (imageUrl: string, index: number) => {
        imageUrls.push(imageUrl);
        setGeneratedImages(prev => {
          const newImages = [...prev];
          newImages[index] = imageUrl;
          return newImages;
        });

        setImageSlots(prev => {
          const newSlots = [...prev];
          newSlots[index] = { url: imageUrl, loading: false };
          return newSlots;
        });

        setProgress(25 + ((imageUrls.length / imageCount) * 45));
      };

      const onImageFailed = (error: string, index: number) => {
        setImageSlots(prev => {
          const newSlots = [...prev];
          newSlots[index] = { loading: false, error };
          return newSlots;
        });
      };

      await generateImageWithKie(diversePrompts, apiKeys.kie, onImageComplete, onImageFailed, imageRatio);
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
      job.regeneratedImageUrls = imageUrls.filter(Boolean);
      job.selectedImageUrls = [];
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

    if (!currentJob?.selectedImageUrls?.length || !currentJob.videoPrompt) {
      toast({
        title: 'Image Selection Required',
        description: 'Please select at least one image before creating videos.',
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
      const totalVideos = job.selectedImageUrls!.length;
      for (let i = 0; i < totalVideos; i++) {
        setStatusMessage(`Generating video ${i + 1} of ${totalVideos}...`);

        const videoUrl = await generateVideoWithKie(
          job.selectedImageUrls![i],
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
        setProgress(Math.round(((i + 1) / totalVideos) * 90) + 10);
        setCurrentJob({ ...job });
      }

      job.status = 'completed';
      job.videoCount = totalVideos;
      setCurrentJob(job);
      addJobToHistory(job);

      toast({
        title: 'Success!',
        description: `Generated ${totalVideos} video${totalVideos !== 1 ? 's' : ''} successfully`,
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

              <div className="grid gap-4 md:grid-cols-2">
                {/* Number of Images */}
                <div className="space-y-2">
                  <Label htmlFor="imageCount" className="text-white">
                    Number of Images to Generate (1-10)
                  </Label>
                  <Input
                    id="imageCount"
                    type="number"
                    min="1"
                    max="10"
                    value={imageCount}
                    onChange={(e) => setImageCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                    className="bg-white/5 border-white/20 text-white"
                    disabled={isGeneratingImage || isGeneratingVideos}
                  />
                </div>

                {/* Image Aspect Ratio */}
                <div className="space-y-2">
                  <Label htmlFor="imageRatio" className="text-white">
                    Image Aspect Ratio
                  </Label>
                  <select
                    id="imageRatio"
                    value={imageRatio}
                    onChange={(e) => setImageRatio(e.target.value)}
                    className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/40 [&>option]:bg-gray-800 [&>option]:text-white"
                    disabled={isGeneratingImage || isGeneratingVideos}
                  >
                    <option value="portrait_16_9" className="bg-gray-800 text-white">Portrait (9:16)</option>
                    <option value="landscape_16_9" className="bg-gray-800 text-white">Landscape (16:9)</option>
                    <option value="square_hd" className="bg-gray-800 text-white">Square (1:1)</option>
                    <option value="portrait_4_3" className="bg-gray-800 text-white">Portrait (3:4)</option>
                    <option value="landscape_4_3" className="bg-gray-800 text-white">Landscape (4:3)</option>
                  </select>
                </div>
              </div>
              <div className="text-sm text-white/60">
                More images = more video options. Each selected image creates one video.
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

              {imageSlots.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-white">Select Images for Video Generation</Label>
                    <div className="text-sm text-white/70">
                      {selectedImageIndices.length > 0 && (
                        <span className="text-green-400">✓ {selectedImageIndices.length} image{selectedImageIndices.length !== 1 ? 's' : ''} selected</span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-white/60 mb-2">
                    Click to select/deselect images. Each selected image will create one video.
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {imageSlots.map((slot, index) => {
                      const actualImageIndex = slot.url ? generatedImages.indexOf(slot.url) : -1;
                      const isSelected = actualImageIndex >= 0 && selectedImageIndices.includes(actualImageIndex);

                      return (
                        <div
                          key={index}
                          className={`relative rounded-lg overflow-hidden border-2 transition-all group ${
                            slot.url && isSelected
                              ? 'border-green-500 ring-2 ring-green-500/50'
                              : 'border-white/20 hover:border-white/40'
                          }`}
                        >
                          {slot.loading ? (
                            // Loading state
                            <div className="w-full h-32 bg-white/5 flex items-center justify-center">
                              <div className="flex flex-col items-center space-y-2">
                                <Loader2 className="w-6 h-6 text-white animate-spin" />
                                <span className="text-white/60 text-xs">Generating...</span>
                              </div>
                            </div>
                          ) : slot.error ? (
                            // Error state
                            <div className="w-full h-32 bg-red-900/20 border border-red-500/30 flex items-center justify-center">
                              <div className="flex flex-col items-center space-y-1 text-center p-2">
                                <X className="w-5 h-5 text-red-400" />
                                <span className="text-red-400 text-xs">Failed</span>
                                <span className="text-red-300/70 text-xs leading-tight">{slot.error}</span>
                              </div>
                            </div>
                          ) : slot.url ? (
                            // Success state
                            <div
                              onClick={() => {
                                if (actualImageIndex >= 0) {
                                  const newSelectedIndices = isSelected
                                    ? selectedImageIndices.filter(i => i !== actualImageIndex)
                                    : [...selectedImageIndices, actualImageIndex];

                                  setSelectedImageIndices(newSelectedIndices);

                                  if (currentJob) {
                                    currentJob.selectedImageUrls = newSelectedIndices.map(i => generatedImages[i]);
                                    setCurrentJob({ ...currentJob });
                                  }
                                }
                              }}
                              className="cursor-pointer hover:scale-105 transition-transform"
                            >
                              <img
                                src={slot.url}
                                alt={`Generated option ${index + 1}`}
                                className="w-full h-32 object-cover"
                              />
                            </div>
                          ) : null}

                          {/* Action buttons overlay - only for successful images */}
                          {slot.url && !slot.loading && (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (actualImageIndex >= 0) {
                                    openImagePreview(actualImageIndex);
                                  }
                                }}
                                className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition-colors"
                                title="Preview full size"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          )}

                          {/* Option number */}
                          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                            Option {index + 1}
                          </div>

                          {/* Selection indicator */}
                          {slot.url && isSelected && (
                            <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Video Settings - Only show when images are selected */}
                  {selectedImageIndices.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
                      <h3 className="text-white font-semibold text-sm">Video Settings</h3>
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
                            className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/40 [&>option]:bg-gray-800 [&>option]:text-white"
                            disabled={isGeneratingImage || isGeneratingVideos}
                          >
                            <option value="720p" className="bg-gray-800 text-white">720p</option>
                            <option value="1080p" className="bg-gray-800 text-white">1080p</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
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
                  disabled={!currentJob?.selectedImageUrls?.length || !currentJob?.videoPrompt || isGeneratingImage || isGeneratingVideos}
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

      {/* Image Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] bg-black/95 border-white/20">
          <div className="flex items-center justify-center p-4">
            {generatedImages[previewImageIndex] && (
              <img
                src={generatedImages[previewImageIndex]}
                alt={`Generated image ${previewImageIndex + 1}`}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            )}
          </div>
          <div className="flex items-center justify-between p-4 border-t border-white/10">
            <div className="text-white/70 text-sm">
              Image {previewImageIndex + 1} of {generatedImages.length}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewImageIndex(Math.max(0, previewImageIndex - 1))}
                disabled={previewImageIndex === 0}
                className="text-white border-white/20 hover:bg-white/10"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewImageIndex(Math.min(generatedImages.length - 1, previewImageIndex + 1))}
                disabled={previewImageIndex === generatedImages.length - 1}
                className="text-white border-white/20 hover:bg-white/10"
              >
                Next
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsPreviewOpen(false)}
                className="bg-red-600 hover:bg-red-700"
              >
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}









