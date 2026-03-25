import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Check, X, Loader2, ArrowRight, ArrowLeft, Trophy, Star, Zap, ChevronRight, Shield, Timer, Share2, Settings } from "lucide-react";

function getPasswordStrength(pw: string): { level: string; color: string; width: string } {
  if (!pw) return { level: "", color: "", width: "0%" };
  if (pw.length < 6) return { level: "Corta", color: "bg-red-500", width: "33%" };
  const hasUpper = /[A-Z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw);
  const score = [pw.length >= 8, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
  if (score >= 3) return { level: "Fuerte", color: "bg-green-500", width: "100%" };
  return { level: "Aceptable", color: "bg-yellow-500", width: "66%" };
}

export default function Registro() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryPhone, setRecoveryPhone] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameMessage, setUsernameMessage] = useState("");
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [createdUser, setCreatedUser] = useState<any>(null);

  useEffect(() => {
    if (username.length < 3) {
      setUsernameAvailable(null);
      setUsernameMessage("");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameAvailable(false);
      setUsernameMessage("Solo letras, números y guion bajo");
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const res = await fetch(`/api/auth/username-available?username=${encodeURIComponent(username)}`);
        const data = await res.json();
        setUsernameAvailable(data.available);
        setUsernameMessage(data.reason || "");
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [username]);

  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          confirmPassword,
          recoveryEmail: recoveryEmail || undefined,
          recoveryPhone: recoveryPhone || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("auth_token", data.token);
      setCreatedUser(data.user);
      setShowWelcome(true);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const strength = getPasswordStrength(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const step1Valid = username.length >= 3 && usernameAvailable === true && password.length >= 6 && passwordsMatch;

  if (showWelcome && createdUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6 space-y-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Trophy className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900" data-testid="text-welcome-title">
                ¡Bienvenido, {createdUser.username}!
              </h2>
              <p className="text-gray-500 mt-2">Tu cuenta ha sido creada correctamente</p>
            </div>
            <div className="space-y-3 text-left bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-700 text-sm">Funciones desbloqueadas:</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Star className="w-4 h-4 text-yellow-500" />
                <span>Historial de partidos</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Zap className="w-4 h-4 text-blue-500" />
                <span>Equipos favoritos</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Trophy className="w-4 h-4 text-green-500" />
                <span>Logros y gamificación</span>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => setLocation("/")}
              data-testid="button-go-home"
            >
              Comenzar a usar MarcadorLIVE
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col gap-4">
      <Card className="w-full">
        <CardHeader className="text-center pb-2">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Link>
          <CardTitle className="text-xl" data-testid="text-registro-title">Crear cuenta</CardTitle>
          <p className="text-sm text-gray-500">
            {step === 1 ? "Paso 1 de 2: Datos de acceso" : "Paso 2 de 2: Recuperación (opcional)"}
          </p>
          <div className="flex gap-2 mt-2">
            <div className={`h-1 flex-1 rounded ${step >= 1 ? "bg-primary" : "bg-gray-200"}`} />
            <div className={`h-1 flex-1 rounded ${step >= 2 ? "bg-primary" : "bg-gray-200"}`} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="username">Nombre de usuario</Label>
                <div className="relative">
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    placeholder="tu_usuario"
                    maxLength={20}
                    data-testid="input-username"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingUsername && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                    {!checkingUsername && usernameAvailable === true && <Check className="w-4 h-4 text-green-500" />}
                    {!checkingUsername && usernameAvailable === false && <X className="w-4 h-4 text-red-500" />}
                  </div>
                </div>
                {usernameMessage && (
                  <p className={`text-xs ${usernameAvailable ? "text-green-600" : "text-red-500"}`} data-testid="text-username-message">
                    {usernameMessage}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password && (
                  <div className="space-y-1">
                    <div className="h-1.5 bg-gray-200 rounded overflow-hidden">
                      <div className={`h-full ${strength.color} transition-all`} style={{ width: strength.width }} />
                    </div>
                    <p className={`text-xs ${strength.color.replace("bg-", "text-")}`} data-testid="text-password-strength">
                      {strength.level}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Repetir contraseña</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña"
                    data-testid="input-confirm-password"
                  />
                  {confirmPassword && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {passwordsMatch ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-red-500" />}
                    </div>
                  )}
                </div>
                {confirmPassword && !passwordsMatch && (
                  <p className="text-xs text-red-500">Las contraseñas no coinciden</p>
                )}
              </div>

              <Button
                className="w-full"
                onClick={() => setStep(2)}
                disabled={!step1Valid}
                data-testid="button-next-step"
              >
                Siguiente
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-gray-500">
                Opcionalmente puedes agregar un email o teléfono para recuperar tu cuenta si olvidas la contraseña.
              </p>

              <div className="space-y-2">
                <Label htmlFor="recoveryEmail">Email de recuperación</Label>
                <Input
                  id="recoveryEmail"
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="tu@email.com (opcional)"
                  data-testid="input-recovery-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recoveryPhone">Teléfono de recuperación</Label>
                <Input
                  id="recoveryPhone"
                  type="tel"
                  value={recoveryPhone}
                  onChange={(e) => setRecoveryPhone(e.target.value)}
                  placeholder="+34 600 000 000 (opcional)"
                  data-testid="input-recovery-phone"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)} data-testid="button-back">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Atrás
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => registerMutation.mutate()}
                  disabled={registerMutation.isPending}
                  data-testid="button-register"
                >
                  {registerMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Crear cuenta"
                  )}
                </Button>
              </div>

              <button
                onClick={() => registerMutation.mutate()}
                disabled={registerMutation.isPending}
                className="text-xs text-gray-400 hover:text-gray-600 text-center w-full"
                data-testid="button-skip-recovery"
              >
                Saltar este paso →
              </button>
            </>
          )}

          <div className="text-center text-sm text-gray-500 pt-2 border-t">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium" data-testid="link-login">
              Inicia sesión
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="w-full rounded-xl bg-green-600 p-5 shadow-md" data-testid="card-registro-benefits">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-4">Ventajas de registrarte</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
            <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm text-white">Organiza tus partidos</p>
              <p className="text-xs text-green-100">Crea carpetas para diferentes ligas, torneos o temporadas</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
            <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Timer className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm text-white">Historial completo</p>
              <p className="text-xs text-green-100">Accede a todos tus partidos pasados y estadísticas</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
            <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Share2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm text-white">Sincronizado</p>
              <p className="text-xs text-green-100">Accede desde cualquier dispositivo con tu cuenta</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
            <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Star className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm text-white">Logros y recompensas</p>
              <p className="text-xs text-green-100">Desbloquea funcionalidades premium con tu actividad</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
            <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm text-white">Delega la gestión</p>
              <p className="text-xs text-green-100">Comparte el control del marcador con otros delegados</p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
