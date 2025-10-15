import * as faceapi from 'face-api.js';
import { showError } from '@/utils/toast';

// Helper para gerar embeddings no navegador
export async function generateEmbeddings(imageUrls: string[]): Promise<Float32Array[]> {
  const embeddings: Float32Array[] = [];
  for (const url of imageUrls) {
    try {
      // Usamos um proxy CORS se a URL não for um data URL
      const imageUrl = url.startsWith('data:') ? url : `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const img = await faceapi.fetchImage(imageUrl);
      const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
      if (detection) {
        embeddings.push(detection.descriptor);
      }
    } catch (error) {
      console.error(`Falha ao processar a imagem: ${url}`, error);
      showError(`Não foi possível processar uma das imagens. Tente uma foto mais nítida.`);
    }
  }
  return embeddings;
}