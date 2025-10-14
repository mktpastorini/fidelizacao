import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type CodeBlockProps = {
  code: string;
};

export function CodeBlock({ code }: CodeBlockProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    toast.success("Copiado para a área de transferência!");
  };

  return (
    <div className="relative">
      <pre className="bg-gray-900 text-white p-4 rounded-md overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-700"
        onClick={handleCopy}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}