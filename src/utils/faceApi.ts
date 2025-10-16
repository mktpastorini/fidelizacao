import * as faceapi from 'face-api.js';
import { showError } from '@/utils/toast';

const MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
let areModelsLoaded = false;

async function loadModels() {
  if (areModelsLoaded) return;
  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
    ]);
    areModelsLoaded = true;
  } catch (e) {
    console.error("Erro crítico ao carregar modelos de IA:", e);
    showError('Falha ao carregar os modelos de IA. Verifique a conexão e recarregue a página.');
    throw new Error("Falha ao carregar modelos de IA.");
  }
}

// Helper para gerar embeddings no navegador
export async function generateEmbeddings(imageUrls: string[]): Promise<Float32Array[]> {
  await loadModels(); // Garante que os modelos estão carregados antes de prosseguir

  const embeddings: Float32Array[] = [];
  for (const url of imageUrls) {
    let objectUrl: string | null = null;
    try {
      let imageElement: HTMLImageElement;

      if (url.startsWith('data:')) {
        // Para data URLs (da webcam), usamos diretamente
        imageElement = await faceapi.fetchImage(url);
      } else {
        // Para URLs externas (Supabase Storage), fazemos o fetch como blob para evitar problemas de CORS
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Falha ao buscar a imagem do armazenamento: ${response.statusText}`);
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        imageElement = await faceapi.fetchImage(objectUrl);
      }

      const detection = await faceapi.detectSingleFace(imageElement).withFaceLandmarks().withFaceDescriptor();
      
      if (detection) {
        embeddings.push(detection.descriptor);
      } else {
        showError(`Não foi possível detectar um rosto em uma das imagens. Tente uma foto com o rosto mais visível.`);
      }
    } catch (error) {
      console.error(`Falha ao processar a imagem: ${url}`, error);
      showError(`Ocorreu um erro ao processar uma das imagens. Verifique sua conexão e tente novamente.`);
    } finally {
      // Limpa a URL do objeto para evitar vazamentos de memória
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    }
  }
  return embeddings;
}