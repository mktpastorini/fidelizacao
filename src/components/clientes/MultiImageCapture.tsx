import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { FaceRegistration } from "@/components/clientes/FaceRegistration";
import { Button } from "../ui/button";
import { Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { User } from "lucide-react";

type MultiImageCaptureProps = {
  urls: string[];
  onUrlsChange: (urls: string[]) => void;
};

export function MultiImageCapture({ urls, onUrlsChange }: MultiImageCaptureProps) {
  const handleUpload = (url: string) => {
    onUrlsChange([...urls, url]);
  };

  const handleRemove = (indexToRemove: number) => {
    onUrlsChange(urls.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Enviar Arquivo</TabsTrigger>
          <TabsTrigger value="camera">Usar Câmera</TabsTrigger>
        </TabsList>
        <TabsContent value="upload">
          <ImageUpload
            bucket="client_avatars"
            onUpload={handleUpload}
            url={null} // Reset after each upload
          />
        </TabsContent>
        <TabsContent value="camera">
          <FaceRegistration
            onFaceRegistered={handleUpload}
            isSubmitting={false}
          />
        </TabsContent>
      </Tabs>
      
      {urls.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Fotos para Registro ({urls.length}/5)</h4>
          <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/50">
            {urls.map((url, index) => (
              <div key={index} className="relative">
                <Avatar className="h-16 w-16 rounded-md">
                  <AvatarImage src={url} className="object-cover" />
                  <AvatarFallback><User /></AvatarFallback>
                </Avatar>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={() => handleRemove(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">A primeira foto será usada como avatar do perfil.</p>
        </div>
      )}
    </div>
  );
}