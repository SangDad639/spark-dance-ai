import { Layout } from '@/components/Layout';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Download, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function History() {
  const { jobHistory, removeJobFromHistory, clearHistory } = useAppContext();

  const handleDelete = (jobId: string) => {
    removeJobFromHistory(jobId);
    toast({
      title: 'Deleted',
      description: 'Job removed from history',
    });
  };

  const handleClearAll = () => {
    clearHistory();
    toast({
      title: 'History Cleared',
      description: 'All jobs have been removed',
    });
  };

  if (jobHistory.length === 0) {
    return (
      <Layout>
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardContent className="py-16 text-center">
            <p className="text-white/70 text-lg">No generation history yet</p>
            <p className="text-white/50 mt-2">Start creating videos to see your history</p>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Generation History</h1>
          <Button onClick={handleClearAll} variant="destructive" size="sm">
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
        </div>

        <div className="grid gap-4">
          {jobHistory.map((job) => (
            <Card key={job.id} className="bg-white/10 backdrop-blur-lg border-white/20">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-white">
                      {job.videos.length} Video{job.videos.length !== 1 ? 's' : ''} Generated
                    </CardTitle>
                    <CardDescription className="text-white/70">
                      {format(new Date(job.createdAt), 'PPpp')}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(job.id)}
                    className="text-white hover:bg-white/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {job.videos.map((video) => (
                    <div key={video.id} className="space-y-2">
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
                          <a href={video.videoUrl} download>
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
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
