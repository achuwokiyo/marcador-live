import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Mail, Phone, Check, Eye, EyeOff } from "lucide-react";

export default function Recuperar() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [contactType, setContactType] = useState<"email" | "phone">("email");
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const requestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/recovery/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, type: contactType }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      setStep(2);
      toast({ title: "Código enviado", description: "Revisa tu bandeja de entrada o mensajes" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/recovery/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, code }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResetToken(data.resetToken);
      setStep(3);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error("Las contraseñas no coinciden");
      }
      const res = await fetch("/api/auth/recovery/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, newPassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      setStep(4);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <Link href="/login" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="w-4 h-4" />
            Volver al login
          </Link>
          <CardTitle className="text-xl" data-testid="text-recuperar-title">Recuperar contraseña</CardTitle>
          <div className="flex gap-2 mt-2">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={`h-1 flex-1 rounded ${step >= s ? "bg-primary" : "bg-gray-200"}`} />
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && (
            <>
              <p className="text-sm text-gray-500">
                Elige cómo quieres recuperar tu cuenta y escribe el dato que registraste.
              </p>

              <div className="flex gap-2">
                <Button
                  variant={contactType === "email" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setContactType("email")}
                  data-testid="button-type-email"
                >
                  <Mail className="w-4 h-4 mr-1" />
                  Email
                </Button>
                <Button
                  variant={contactType === "phone" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setContactType("phone")}
                  data-testid="button-type-phone"
                >
                  <Phone className="w-4 h-4 mr-1" />
                  Teléfono
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">
                  {contactType === "email" ? "Email de recuperación" : "Teléfono de recuperación"}
                </Label>
                <Input
                  id="contact"
                  type={contactType === "email" ? "email" : "tel"}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={contactType === "email" ? "tu@email.com" : "+34 600 000 000"}
                  data-testid="input-contact"
                />
              </div>

              <Button
                className="w-full"
                onClick={() => requestMutation.mutate()}
                disabled={requestMutation.isPending || !contact}
                data-testid="button-send-code"
              >
                {requestMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Enviar código"
                )}
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-gray-500">
                Introduce el código de 6 dígitos que hemos enviado a tu {contactType === "email" ? "email" : "teléfono"}.
              </p>

              <div className="space-y-2">
                <Label htmlFor="code">Código de verificación</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-mono"
                  data-testid="input-code"
                />
              </div>

              <Button
                className="w-full"
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending || code.length !== 6}
                data-testid="button-verify-code"
              >
                {verifyMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Verificar código"
                )}
              </Button>

              <button
                onClick={() => requestMutation.mutate()}
                disabled={requestMutation.isPending}
                className="text-xs text-gray-400 hover:text-gray-600 text-center w-full"
                data-testid="button-resend-code"
              >
                {requestMutation.isPending ? "Enviando..." : "Reenviar código"}
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm text-gray-500">
                Elige tu nueva contraseña.
              </p>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    data-testid="input-new-password"
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">Repetir contraseña</Label>
                <Input
                  id="confirmNewPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                  data-testid="input-confirm-new-password"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500">Las contraseñas no coinciden</p>
                )}
              </div>

              <Button
                className="w-full"
                onClick={() => resetMutation.mutate()}
                disabled={resetMutation.isPending || newPassword.length < 6 || newPassword !== confirmPassword}
                data-testid="button-reset-password"
              >
                {resetMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Cambiar contraseña"
                )}
              </Button>
            </>
          )}

          {step === 4 && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg" data-testid="text-recovery-success">¡Contraseña restablecida!</h3>
                <p className="text-sm text-gray-500 mt-1">Ya puedes iniciar sesión con tu nueva contraseña</p>
              </div>
              <Link href="/login">
                <Button className="w-full" data-testid="button-go-login">
                  Ir a iniciar sesión
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
