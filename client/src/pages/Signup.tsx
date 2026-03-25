import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Loader2, Users, FolderOpen, BarChart3, ArrowLeft, Trophy, UserCheck } from "lucide-react";
import { Link } from "wouter";

export default function Signup() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const features = [
    {
      icon: FolderOpen,
      title: "Organiza tus partidos",
      description: "Crea carpetas para diferentes ligas, torneos o temporadas"
    },
    {
      icon: BarChart3,
      title: "Historial completo",
      description: "Accede a todos tus partidos pasados y estadísticas"
    },
    {
      icon: Users,
      title: "Sincronizado",
      description: "Accede desde cualquier dispositivo con tu cuenta"
    },
    {
      icon: Trophy,
      title: "Logros y recompensas",
      description: "Desbloquea funcionalidades premium con tu actividad"
    },
    {
      icon: UserCheck,
      title: "Delega la gestión",
      description: "Comparte el control del marcador con otro usuario"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header: Volver + Logo */}
      <header className="p-4 flex items-center justify-between border-b bg-white">
        <Link href="/">
          <Button variant="ghost" size="lg" className="text-muted-foreground text-base">
            <ArrowLeft className="w-6 h-6 mr-2" />
            Volver
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
          <span className="font-black text-lg tracking-tight uppercase">
            Marcador<span className="text-primary">LIVE</span>
          </span>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-6 max-w-lg mx-auto w-full">
        {/* Title Section */}
        <div className="text-center pt-4">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Gestiona todos tus marcadores en un solo lugar
          </h1>
          <p className="text-muted-foreground">
            Inicia sesión o regístrate gratis para guardar tu historial.
          </p>
        </div>

        {/* Login Zone */}
        <Card className="border-0 shadow-xl">
          <CardContent className="p-6 space-y-4">
            <Button 
              className="w-full h-14 text-sm font-semibold"
              onClick={() => window.location.href = "/api/login"}
              data-testid="button-signup"
            >
              Iniciar sesión o registrarse
            </Button>
            
            <p className="text-center text-xs text-muted-foreground">
              Al continuar, aceptas nuestros términos de uso y política de privacidad.
            </p>
          </CardContent>
        </Card>

        {/* Benefits Section */}
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl p-5 text-white">
          <h2 className="font-bold text-lg mb-4 text-center">Ventajas de registrarte</h2>
          <div className="space-y-3">
            {features.map((feature, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/10 rounded-lg p-3 border-2 border-[whitesmoke]">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{feature.title}</h3>
                  <p className="text-white/70 text-xs">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-muted-foreground border-t bg-white">
        © {new Date().getFullYear()} MarcadorLIVE
      </footer>
    </div>
  );
}
