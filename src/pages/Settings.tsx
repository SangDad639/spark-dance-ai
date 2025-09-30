import { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Save, Trash2 } from 'lucide-react';

export default function Settings() {
  const { apiKeys, setApiKeys } = useAppContext();
  
  const [formData, setFormData] = useState({
    openai: apiKeys?.openai || '',
    fal: apiKeys?.fal || '',
    n8nWebhook: apiKeys?.n8nWebhook || '',
    googleDriveFolderId: apiKeys?.googleDriveFolderId || '',
    facebookPageId: apiKeys?.facebookPageId || '',
    facebookAccessToken: apiKeys?.facebookAccessToken || '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!formData.openai || !formData.fal) {
      toast({
        title: 'Missing Required Fields',
        description: 'OpenAI API Key and FAL.AI API Key are required.',
        variant: 'destructive',
      });
      return;
    }

    setApiKeys(formData);
    toast({
      title: 'Settings Saved',
      description: 'Your API keys have been saved successfully.',
    });
  };

  const handleClear = () => {
    setFormData({
      openai: '',
      fal: '',
      n8nWebhook: '',
      googleDriveFolderId: '',
      facebookPageId: '',
      facebookAccessToken: '',
    });
    localStorage.removeItem('apiKeys');
    toast({
      title: 'Settings Cleared',
      description: 'All API keys have been removed.',
    });
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardHeader>
            <CardTitle className="text-white text-2xl">API Configuration</CardTitle>
            <CardDescription className="text-white/70">
              Configure your API keys to enable video generation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openai" className="text-white">OpenAI API Key *</Label>
              <Input
                id="openai"
                type="password"
                value={formData.openai}
                onChange={(e) => handleChange('openai', e.target.value)}
                placeholder="sk-..."
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fal" className="text-white">FAL.AI API Key *</Label>
              <Input
                id="fal"
                type="password"
                value={formData.fal}
                onChange={(e) => handleChange('fal', e.target.value)}
                placeholder="Your FAL.AI API key"
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="n8nWebhook" className="text-white">n8n Webhook URL (Optional)</Label>
              <Input
                id="n8nWebhook"
                type="url"
                value={formData.n8nWebhook}
                onChange={(e) => handleChange('n8nWebhook', e.target.value)}
                placeholder="https://..."
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="googleDrive" className="text-white">Google Drive Folder ID (Optional)</Label>
              <Input
                id="googleDrive"
                value={formData.googleDriveFolderId}
                onChange={(e) => handleChange('googleDriveFolderId', e.target.value)}
                placeholder="Folder ID"
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fbPageId" className="text-white">Facebook Page ID (Optional)</Label>
              <Input
                id="fbPageId"
                value={formData.facebookPageId}
                onChange={(e) => handleChange('facebookPageId', e.target.value)}
                placeholder="Page ID"
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fbToken" className="text-white">Facebook Access Token (Optional)</Label>
              <Input
                id="fbToken"
                type="password"
                value={formData.facebookAccessToken}
                onChange={(e) => handleChange('facebookAccessToken', e.target.value)}
                placeholder="Access token"
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={handleSave} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </Button>
              <Button onClick={handleClear} variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
