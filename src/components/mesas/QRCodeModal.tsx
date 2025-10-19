import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRef } from "react";
import QRCode from "qrcode.react";

type QRCodeModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mesaNumero: number;
  qrCodeUrl: string;
};

export function QRCodeModal({ isOpen, onOpenChange, mesaNumero, qrCodeUrl }: QRCodeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    const downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `mesa-${mesaNumero}-qrcode.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle>QR Code da Mesa {mesaNumero}</DialogTitle>
        </DialogHeader>
        <div className="my-4 flex justify-center">
          <QRCode
            value={qrCodeUrl}
            size={256}
            includeMargin
            renderAs="canvas"
            ref={canvasRef}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleDownload}>Baixar QR Code</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}