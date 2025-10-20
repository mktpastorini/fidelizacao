'use client';
import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, Chrome, Twitter, Gamepad2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

// --- Helper Components (Internal) ---

interface FormInputProps {
    icon: React.ReactNode;
    type: string;
    placeholder: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    required?: boolean;
    autocomplete?: string; // Adicionando autocomplete
}

const FormInput: React.FC<FormInputProps> = ({ icon, type, placeholder, value, onChange, required, autocomplete }) => {
    return (
        <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                {icon}
            </div>
            <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                required={required}
                autoComplete={autocomplete} // Usando autocomplete
                className="w-full pl-10 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-purple-600/50 transition-colors"
            />
        </div>
    );
};

interface SocialButtonProps {
    icon: React.ReactNode;
    provider: 'google' | 'twitter' | 'steam';
    disabled: boolean;
    onClick: (provider: 'google' | 'twitter' | 'steam') => void;
}

const SocialButton: React.FC<SocialButtonProps> = ({ icon, provider, disabled, onClick }) => {
    return (
        <button 
            type="button"
            onClick={() => onClick(provider)}
            disabled={disabled}
            className="flex items-center justify-center p-2 bg-white/5 border border-white/10 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {icon}
        </button>
    );
};

interface ToggleSwitchProps {
    checked: boolean;
    onChange: () => void;
    id: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, id }) => {
    return (
        <div className="relative inline-block w-10 h-5 cursor-pointer">
            <input
                type="checkbox"
                id={id}
                className="sr-only"
                checked={checked}
                onChange={onChange}
            />
            <div className={`absolute inset-0 rounded-full transition-colors duration-200 ease-in-out ${checked ? 'bg-purple-600' : 'bg-white/20'}`}>
                <div className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out ${checked ? 'transform translate-x-5' : ''}`} />
            </div>
        </div>
    );
};

// --- Main Component ---

export function LoginForm() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleEmailPasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            showError(error.message);
            setIsSubmitting(false);
        } else {
            setIsSuccess(true);
            // Supabase listener in AuthLayout handles navigation on SIGNED_IN
        }
    };

    const handleSocialLogin = async (provider: 'google' | 'twitter' | 'steam') => {
        setIsSubmitting(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}/`,
            },
        });

        if (error) {
            showError(error.message);
            setIsSubmitting(false);
        }
        // Note: OAuth redirects away, so no need to handle success here.
    };
    
    const handleSignUp = () => {
        // O cadastro de novos usuários é geralmente restrito ou feito por um administrador em sistemas B2B.
        showError("O cadastro de novos usuários deve ser feito pelo administrador do sistema.");
    };
    
    const handleForgotPassword = () => {
        // Supabase handles password reset via email link. We prompt the user for their email.
        const userEmail = prompt("Por favor, insira seu e-mail para redefinir a senha:");
        if (userEmail) {
            supabase.auth.resetPasswordForEmail(userEmail, {
                redirectTo: `${window.location.origin}/login?message=Check your email for the password reset link`,
            }).then(({ error }) => {
                if (error) {
                    showError(error.message);
                } else {
                    showError("Instruções de recuperação de senha enviadas para o seu e-mail.");
                }
            });
        }
    };


    return (
        <div className="p-8 rounded-2xl backdrop-blur-sm bg-black/50 border border-white/10 w-full max-w-md z-20 relative">
            <div className="mb-8 text-center">
                <h2 className="text-3xl font-bold mb-2 relative group">
                    <span className="absolute -inset-1 bg-gradient-to-r from-orange-600/30 via-red-500/30 to-yellow-500/30 blur-xl opacity-75 group-hover:opacity-100 transition-all duration-500 animate-pulse"></span>
                    <span className="relative inline-block text-3xl font-bold mb-2 text-white">
                        Fidelize Gourmet
                    </span>
                    <span className="absolute -inset-0.5 bg-gradient-to-r from-orange-500/20 to-red-500/20 blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300"></span>
                </h2>
                <div className="text-white/80 flex flex-col items-center space-y-1">
                    <span className="relative group cursor-default">
                        <span className="absolute -inset-1 bg-gradient-to-r from-orange-600/20 to-red-600/20 blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500"></span>
                        <span className="relative inline-block animate-pulse">O portal para a gestão do seu restaurante</span>
                    </span>
                    <span className="text-xs text-white/50 animate-pulse">
                        [Pressione Entrar para servir a excelência]
                    </span>
                    <div className="flex space-x-2 text-xs text-white/40">
                        <span className="animate-pulse">🍽️</span>
                        <span className="animate-bounce">⭐</span>
                        <span className="animate-pulse">🥂</span>
                    </div>
                </div>
            </div>

            <form onSubmit={handleEmailPasswordLogin} className="space-y-6">
                <FormInput
                    icon={<Mail className="text-white/60" size={18} />}
                    type="email"
                    placeholder="Endereço de e-mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autocomplete="email"
                />

                <div className="relative">
                    <FormInput
                        icon={<Lock className="text-white/60" size={18} />}
                        type={showPassword ? "text" : "password"}
                        placeholder="Senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autocomplete="current-password"
                    />
                    <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white focus:outline-none transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div onClick={() => setRemember(!remember)} className="cursor-pointer">
                            <ToggleSwitch
                                checked={remember}
                                onChange={() => setRemember(!remember)}
                                id="remember-me"
                            />
                        </div>
                        <label
                            htmlFor="remember-me"
                            className="text-sm text-white/80 cursor-pointer hover:text-white transition-colors"
                            onClick={() => setRemember(!remember)}
                        >
                            Lembrar-me
                        </label>
                    </div>
                    <a 
                        href="#" 
                        className="text-sm text-white/80 hover:text-white transition-colors"
                        onClick={(e) => { e.preventDefault(); handleForgotPassword(); }}
                    >
                        Esqueceu a senha?
                    </a>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full py-3 rounded-lg ${isSuccess
                            ? 'bg-green-600 animate-pulse'
                            : 'bg-purple-600 hover:bg-purple-700'
                        } text-white font-medium transition-all duration-200 ease-in-out transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40`}
                >
                    {isSubmitting ? 'Entrando...' : 'Entrar no Fidelize'}
                </button>
            </form>

            <div className="mt-8">
                <div className="relative flex items-center justify-center">
                    <div className="border-t border-white/10 absolute w-full"></div>
                    <div className="bg-transparent px-4 relative text-white/60 text-sm">
                        acesso rápido via
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3">
                    {/* Note: Supabase supports Google, Twitter, and Steam providers. */}
                    <SocialButton icon={<Chrome size={18} />} provider="google" disabled={isSubmitting} onClick={handleSocialLogin} />
                    <SocialButton icon={<Twitter size={18} />} provider="twitter" disabled={isSubmitting} onClick={handleSocialLogin} />
                    <SocialButton icon={<Gamepad2 size={18} />} provider="steam" disabled={isSubmitting} onClick={handleSocialLogin} />
                </div>
            </div>

            <p className="mt-8 text-center text-sm text-white/60">
                Não tem uma conta?{' '}
                <a 
                    href="#" 
                    className="font-medium text-white hover:text-purple-300 transition-colors"
                    onClick={(e) => { e.preventDefault(); handleSignUp(); }}
                >
                    Criar Conta
                </a>
            </p>
        </div>
    );
}