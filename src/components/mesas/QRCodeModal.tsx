import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRef } from "react";
import QRCode from "react-qr-code";

type QRCodeModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mesaNumero: number;
  qrCodeUrl: string;
};

export function QRCodeModal({ isOpen, onOpenChange, mesaNumero, qrCodeUrl }: QRCodeModalProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const handleDownload = () => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `mesa-${mesaNumero}-qrcode.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
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
            ref={svgRef}
            bgColor="white"
            fgColor="black"
            level="Q"
            includeMargin={true}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleDownload}>Baixar QR Code (SVG)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}