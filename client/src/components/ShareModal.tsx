import QRCode from "react-qr-code";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { SiWhatsapp } from "react-icons/si";

interface ShareModalProps {
  matchId: number;
  localTeam: string;
  awayTeam: string;
  fullWidth?: boolean;
}

export function ShareModal({ matchId, localTeam, awayTeam, fullWidth }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  // Construct URL safely for client-side
  const shareUrl = `${window.location.origin}/match/${matchId}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "¡Copiado!", description: "Enlace copiado al portapapeles" });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo copiar el enlace" });
    }
  };

  const shareToWhatsapp = () => {
    const text = `¡Sigue el resultado en directo del partido ${localTeam} Vs ${awayTeam} aquí: ${shareUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className={`gap-2 bg-primary shadow-md ${fullWidth ? 'w-full' : ''}`} data-testid="button-share-match">
          <Share2 className="w-4 h-4" />
          Compartir Partido
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartir Partido</DialogTitle>
          <DialogDescription>
            Cualquiera con este enlace puede ver el marcador en tiempo real.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center p-6 space-y-6">
          <div className="p-4 bg-white rounded-xl shadow-lg border">
            <QRCode value={shareUrl} size={180} />
          </div>
          
          <div className="grid grid-cols-1 gap-3 w-full">
            <Button 
              onClick={shareToWhatsapp} 
              className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white gap-2 h-11"
            >
              <SiWhatsapp className="w-5 h-5" />
              Compartir por WhatsApp
            </Button>
            
            <div className="flex items-center space-x-2 w-full mt-2">
              <div className="grid flex-1 gap-2">
                <input
                  className="w-full px-3 py-2 text-sm border rounded-md bg-muted text-muted-foreground font-mono"
                  readOnly
                  value={shareUrl}
                />
              </div>
              <Button size="icon" onClick={copyToClipboard} className="shrink-0 h-10 w-10">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
