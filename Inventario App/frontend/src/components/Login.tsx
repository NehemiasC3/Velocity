import React, { useState } from 'react';
import { 
  Boxes, ShieldCheck, Lock, Mail, ArrowRight, 
  AlertTriangle, RefreshCw, KeyRound, Radio, Eye, EyeOff,
  UserCheck, Shield, Truck, PackageCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginProps {
  onLoginSuccess?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Por favor, ingresa tu correo y contraseña');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      await login(email, password);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      console.error('Error al iniciar sesión:', err);
      setErrorMessage(err.message || 'Error de autenticación. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string = '123456') => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
  };

  const demoAccounts = [
    {
      role: 'SuperAdmin / Mesa',
      email: 'admin@rappidopanama.com',
      name: 'Carlos Mendoza',
      badge: 'Acceso Total',
      icon: Shield,
      color: 'from-amber-500/20 to-indigo-500/20 text-amber-300 border-amber-500/30'
    },
    {
      role: 'Bodeguero Central',
      email: 'bodega.tocumen@atg-rappido.com',
      name: 'Mario Pérez',
      badge: 'Hub Tocumen',
      icon: PackageCheck,
      color: 'from-sky-500/20 to-blue-500/20 text-sky-300 border-sky-500/30'
    },
    {
      role: 'Técnico de Campo',
      email: 'ldavid@atg-rappido.com',
      name: 'Luis David',
      badge: 'Cuadrilla #1',
      icon: Truck,
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/30'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100 relative overflow-hidden">
      
      {/* Background glowing effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-sky-600/15 via-indigo-600/15 to-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-xl shadow-sky-500/25 ring-4 ring-sky-500/10 mb-2">
            <Boxes className="w-8 h-8" />
          </div>
          
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-white">
              Velocity <span className="text-sky-400">ISP</span>
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
              v3.2 RBAC
            </span>
          </div>
          
          <p className="text-xs sm:text-sm text-slate-400">
            Mesa de Órdenes & Gestión de Inventario Hub-and-Spoke
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-5">
          
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2.5 animate-shake">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-sky-400" />
                <span>Correo Electrónico Corporativo</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ej. usuario@rappidopanama.com"
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-sky-400" />
                  <span>Contraseña de Acceso</span>
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-4 pr-11 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-heading font-bold text-sm py-3.5 px-4 rounded-xl shadow-lg shadow-sky-600/25 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>

          {/* Quick Demo Logins Selector */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Cuentas de Demostración (RBAC)
              </span>
              <span className="text-[10px] text-sky-400">Click para autocompletar</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {demoAccounts.map((demo) => {
                const IconComponent = demo.icon;
                return (
                  <button
                    key={demo.email}
                    type="button"
                    onClick={() => handleQuickLogin(demo.email)}
                    className={`text-left p-2.5 rounded-xl border bg-gradient-to-r ${demo.color} hover:brightness-110 transition flex items-center justify-between gap-3 text-xs`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <IconComponent className="w-4 h-4 shrink-0" />
                      <div className="truncate">
                        <p className="font-bold text-white truncate">{demo.name}</p>
                        <p className="text-[11px] text-slate-300 truncate">{demo.role}</p>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-900/60 text-slate-200 shrink-0 border border-slate-700/60">
                      {demo.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-500">
          Rappido Panamá • Conexión Segura con Cifrado JWT & Prisma ORM
        </p>

      </div>

    </div>
  );
};
