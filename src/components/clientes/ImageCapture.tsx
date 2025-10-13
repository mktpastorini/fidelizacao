import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { FaceRegistration } from "@/components/clientes/FaceRegistration";

type ImageCaptureProps = {
  url: string | null | undefined;
  onUpload: (url: string) => void;
};

export function ImageCapture({ url, onUpload }: ImageCaptureProps) {
  return (
    <Tabs defaultValue="upload" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="upload">Enviar Arquivo</TabsTrigger>
        <TabsTrigger value="camera">Usar Câmera</TabsTrigger>
      </TabsList>
      <TabsContent value="upload">
        <ImageUpload
          bucket="client_avatars"
          url={url}
          onUpload={onUpload}
        />
      </TabsContent>
      <TabsContent value="camera">
        <FaceRegistration
          onFaceRegistered={onUpload}
          isSubmitting={false} // O botão de submit do formulário principal controla o estado
        />
      </TabsContent>
    </Tabs>
  );
}