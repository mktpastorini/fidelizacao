import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { User } from 'lucide-react';
import { showError } from '@/utils/toast';

type ImageUploadProps = {
  bucket: string;
  url: string | null;
  onUpload: (url: string) => void;
};

export function ImageUpload({ bucket, url, onUpload }: ImageUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(url);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setAvatarUrl(url);
  }, [url]);

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setIsUploading(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Você precisa selecionar uma imagem para fazer o upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      if (!data.publicUrl) throw new Error("Não foi possível obter a URL pública da imagem.");
      
      setAvatarUrl(data.publicUrl);
      onUpload(data.publicUrl);
    } catch (error: any) {
      showError(error.message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-20 w-20">
        <AvatarImage src={avatarUrl || undefined} alt="Avatar do Cliente" />
        <AvatarFallback>
          <User className="h-10 w-10 text-gray-400" />
        </AvatarFallback>
      </Avatar>
      <div>
        <Button asChild variant="outline">
          <label htmlFor="single">
            {isUploading ? 'Enviando...' : 'Enviar Foto'}
          </label>
        </Button>
        <input
          style={{ visibility: 'hidden', position: 'absolute' }}
          type="file"
          id="single"
          accept="image/*"
          onChange={uploadAvatar}
          disabled={isUploading}
        />
      </div>
    </div>
  );
}