import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Download, Copy, Home, ExternalLink } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

export default function Results() {
  const navigate = useNavigate();
  const { currentJob } = useAppContext();

  if (!currentJob || currentJob.videos.length === 0) {
    return (
      <Layout>
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardContent className="py-16 text-center">
            <p className="text-white/70 text-lg">No results to display</p>
            <Button onClick={() => navigate('/')} className="mt-4">
              <Home className="w-4 h-4 mr-2" />
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  const caption = currentJob.videos[0]?.caption || '';

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(caption);
    toast({
      title: 'Copied!',
      description: 'Caption copied to clipboard',
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Generated Videos</h1>
            <p className="text-white/70 mt-1">{currentJob.videos.length} video{currentJob.videos.length !== 1 ? 's' : ''} ready</p>
          </div>
          <Button onClick={() => navigate('/')}>
            <Home className="w-4 h-4 mr-2" />
            Create New
          </Button>
        </div>

        {/* Videos Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentJob.videos.map((video, index) => (
            <Card key={video.id} className="bg-white/10 backdrop-blur-lg border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Video {index + 1}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <video
                  src={video.videoUrl}
                  controls
                  className="w-full rounded-lg aspect-[9/16] object-cover"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    asChild
                  >
                    <a href={video.videoUrl} download={`video-${index + 1}.mp4`}>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    asChild
                  >
                    <a href={video.videoUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Caption */}
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Social Media Caption</CardTitle>
            <CardDescription className="text-white/70">
              Copy this caption for your posts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={caption}
              readOnly
              className="min-h-[150px] bg-white/5 border-white/20 text-white"
            />
            <Button onClick={handleCopyCaption} className="w-full">
              <Copy className="w-4 h-4 mr-2" />
              Copy Caption
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
