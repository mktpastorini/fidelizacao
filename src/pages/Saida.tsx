import { useState, useEffect, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, Loader2, AlertTriangle, CheckCircle, XCircle, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { useSettings } from "@/contexts/SettingsContext";
import { useSuperadminId } from "@/hooks/useSuperadminId";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Cliente } from "@/types/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/utils/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ItemPedido = {
  id: string;
  nome_produto: string;
  quantidade: number;
  preco: number;
  consumido_por_cliente_id: string | null;
  desconto_percentual: number;
};

type PedidoDetalhes = {
  id: string;
  created_at: string;
  itens_pedido: ItemPedido[];
};

type TableDetails = {
  mesa_id: string;
  mesa_numero: number;
  pedido: PedidoDetalhes;
  ocupantes: { id: string; nome: string }[];
};

type DetectedClient = {
  cliente: Cliente;
  tableDetails: TableDetails | null;
  similarity: number;
};

export default function SaidaPage() {
  const webcamRef = useRef<Webcam>(null);
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const { superadminId } = useSuperadminId();

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectedClient, setDetectedClient] = useState<DetectedClient | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastDetectionTime, setLastDetectionTime] = useState(0);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(settings?.preferred_camera_device_id || null);

  const detectionInterval = settings?.multi_detection_interval || 2000;
  const detectionConfidence = settings?.multi_detection_confidence || 0.85;

  const videoConstraints = {
    width: 640,
    height: 480,
    deviceId: selectedDeviceId || undefined,
  };

  const handleUserMediaError = useCallback((e: any) => {
    console.error("Erro ao acessar a câmera:", e);
    setCameraError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    setIsCameraActive(false);
  }, []);

  const captureAndProcess = useCallback(async () => {
    if (isProcessing || !isCameraActive) return;

    const now = Date.now();
    if (now - lastDetectionTime < detectionInterval) {
      return;
    }
    setLastDetectionTime(now);

    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;

    setIsProcessing(true);
    setCameraError(null);

    try {
      const file = await dataURLtoFile(imageSrc, `detection-${Date.now()}.jpg`);
      if (!file) throw new Error("Falha ao converter imagem.");

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('temp_faces')
        .upload(`detection/${Date.now()}_${file.name}`, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('temp_faces').getPublicUrl(uploadData.path);
      if (!publicUrlData.publicUrl) throw new Error("Falha ao obter URL pública.");

      const { data: detectionResult, error: detectionError } = await supabase.functions.invoke('detect-and-identify-client', {
        body: {
          image_url: publicUrlData.publicUrl,
          threshold: detectionConfidence,
          user_id: superadminId,
        }
      });

      if (detectionError) throw detectionError;

      if (detectionResult && detectionResult.client_id) {
        await handleClientDetected(detectionResult.client_id, detectionResult.similarity);
      } else {
        // Nenhuma detecção ou cliente identificado
      }

    } catch (error: any) {
      console.error("Erro no processamento de saída:", error);
      setCameraError(`Erro: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, isCameraActive, lastDetectionTime, detectionInterval, detectionConfidence, superadminId]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isCameraActive) {
      interval = setInterval(captureAndProcess, detectionInterval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCameraActive, captureAndProcess, detectionInterval]);

  const handleClientDetected = async (clienteId: string, similarity: number) => {
    // 1. Buscar detalhes do cliente
    const { data: clienteData, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', clienteId)
      .single();

    if (clienteError || !clienteData) {
      console.error("Erro ao buscar cliente:", clienteError?.message);
      return;
    }

    // 2. Verificar se o cliente tem conta aberta
    const { data: tableDetails, error: tableError } = await supabase.rpc('get_customer_table_details', {
      p_cliente_id: clienteId
    });

    if (tableError) {
      console.error("Erro ao buscar detalhes da mesa:", tableError.message);
      // Continua mesmo com erro, mas sem detalhes da mesa
    }

    const details = tableDetails && tableDetails.length > 0 ? tableDetails[0] : null;

    setDetectedClient({
      cliente: clienteData,
      tableDetails: details,
      similarity: similarity,
    });
    setIsModalOpen(true);
  };

  const dataURLtoFile = (dataurl: string, filename: string) => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  const handleToggleCamera = () => {
    if (isCameraActive) {
      setIsCameraActive(false);
      setCameraError(null);
    } else {
      setIsCameraActive(true);
      setCameraError(null);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setDetectedClient(null);
  };

  const calculateTotal = (items: ItemPedido[]) => {
    return items.reduce((total, item) => {
      const itemTotal = item.quantidade * item.preco;
      const discount = itemTotal * (item.desconto_percentual / 100);
      return total + (itemTotal - discount);
    }, 0);
  };

  const totalOrderValue = detectedClient?.tableDetails?.pedido?.itens_pedido ? calculateTotal(detectedClient.tableDetails.pedido.itens_pedido) : 0;
  const hasOpenOrder = detectedClient?.tableDetails !== null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-grow flex flex-col lg:flex-row gap-6">
        {/* Coluna da Câmera */}
        <Card className="lg:w-1/2 flex flex-col">
          <CardHeader>
            <CardTitle>Câmera de Monitoramento</CardTitle>
            <p className="text-sm text-muted-foreground">Confiança mínima: {detectionConfidence * 100}%</p>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col items-center justify-center p-4">
            <div className="relative w-full max-w-lg aspect-video bg-black rounded-lg overflow-hidden">
              {isCameraActive && !cameraError ? (
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  className="w-full h-full object-cover"
                  mirrored={true}
                  onUserMediaError={handleUserMediaError}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
                  {cameraError ? (
                    <div className="text-center p-4">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                      <p>{cameraError}</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Camera className="w-8 h-8 mx-auto mb-2" />
                      <p>Câmera Desativada</p>
                    </div>
                  )}
                </div>
              )}
              {isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-4">
              <Button onClick={handleToggleCamera} variant={isCameraActive ? "destructive" : "default"}>
                {isCameraActive ? "Parar Monitoramento" : "Iniciar Monitoramento"}
              </Button>
              {isCameraActive && (
                <Button onClick={() => captureAndProcess()} disabled={isProcessing} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" /> Forçar Detecção
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Coluna de Status */}
        <Card className="lg:w-1/2 flex flex-col">
          <CardHeader>
            <CardTitle>Status da Detecção</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow flex items-center justify-center">
            {detectedClient ? (
              <div className="text-center p-6 border rounded-lg w-full max-w-sm">
                <Avatar className="w-20 h-20 mx-auto mb-4">
                  <AvatarImage src={detectedClient.cliente.avatar_url || undefined} />
                  <AvatarFallback><User className="w-10 h-10" /></AvatarFallback>
                </Avatar>
                <h3 className="text-xl font-semibold">{detectedClient.cliente.nome}</h3>
                <p className="text-sm text-muted-foreground mb-4">Confiança: {(detectedClient.similarity * 100).toFixed(2)}%</p>
                
                {hasOpenOrder ? (
                  <div className="text-red-600">
                    <XCircle className="w-6 h-6 mx-auto mb-2" />
                    <p className="font-bold">CONTA ABERTA DETECTADA!</p>
                    <p className="text-lg font-semibold">{formatCurrency(totalOrderValue)}</p>
                    <Button onClick={() => setIsModalOpen(true)} variant="destructive" className="mt-3">
                      Ver Detalhes da Conta
                    </Button>
                  </div>
                ) : (
                  <div className="text-green-600">
                    <CheckCircle className="w-6 h-6 mx-auto mb-2" />
                    <p className="font-bold">NENHUMA CONTA ABERTA</p>
                    <p className="text-sm text-muted-foreground">Cliente liberado.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <p>Aguardando detecção de cliente...</p>
                <p className="text-sm mt-1">Certifique-se de que o monitoramento está ativo.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Detalhes da Conta */}
      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Conta Aberta - {detectedClient?.cliente.nome}</DialogTitle>
            <DialogDescription>
              Detalhes do pedido associado à mesa {detectedClient?.tableDetails?.mesa_numero}.
            </DialogDescription>
          </DialogHeader>
          {detectedClient && detectedClient.tableDetails && (
            <div className="space-y-4">
              <div className="flex justify-between font-semibold">
                <span>Mesa:</span>
                <span>{detectedClient.tableDetails.mesa_numero}</span>
              </div>
              <Separator />
              <h4 className="font-semibold">Itens Pendentes:</h4>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {detectedClient.tableDetails.pedido.itens_pedido.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.quantidade}x {item.nome_produto}</span>
                    <span>{formatCurrency(item.quantidade * item.preco)}</span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total da Conta:</span>
                <span className="text-red-600">{formatCurrency(totalOrderValue)}</span>
              </div>
              <Button onClick={handleCloseModal} className="w-full">
                Notificar Garçom / Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}