'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Building2, FileText, BarChart3, Shield, ArrowRight } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (data.success) {
                // Store session info
                localStorage.setItem('devco_session_valid', 'true');
                localStorage.setItem('devco_user', JSON.stringify(data.user));
                
                router.push('/dashboard');
            } else {
                setError(data.error || 'Login failed');
                setLoading(false);
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('An error occurred. Please try again.');
            setLoading(false);
        }
    };

    const features = [
        { icon: Building2, title: 'CRM', desc: 'Manage clients & leads' },
        { icon: FileText, title: 'Jobs', desc: 'Estimates & proposals' },
        { icon: BarChart3, title: 'Reports', desc: 'Payroll & analytics' },
        { icon: Shield, title: 'Docs', desc: 'Safety & compliance' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex">

            {/* Left Side - Branding & Features */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-500 to-blue-600 relative overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-96 h-96 bg-blue-400/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-300/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
                <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-white/10 rounded-full blur-2xl" />

                {/* Grid Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{
                        backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                        backgroundSize: '40px 40px'
                    }} />
                </div>

                {/* Content */}
                <div className={`relative z-10 flex flex-col justify-center p-16 text-white transition-all duration-700 ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
                    {/* Logo */}
                    <div className="flex items-center gap-4 mb-12">
                        <Image
                            src="/devco-logo-v3.png"
                            alt="DevCo Logo"
                            width={64}
                            height={64}
                            className="rounded-2xl shadow-2xl"
                        />
                        <div>
                            <h1 className="text-3xl font-bold tracking-wide">
                                DEVCOERP
                            </h1>
                            <p className="text-blue-100 text-sm">Cloud Solutions</p>
                        </div>
                    </div>

                    {/* Main Headline */}
                    <h2 className="text-4xl font-bold leading-tight mb-4">
                        Complete Business<br />
                        Management Solution
                    </h2>
                    <p className="text-blue-100 text-lg mb-12 max-w-md">
                        Streamline your operations with our integrated ERP system. Manage CRM, jobs, documents, and reports all in one place.
                    </p>

                    {/* Feature Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {features.map((feature, i) => (
                            <div
                                key={feature.title}
                                className={`bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 transition-all duration-500 hover:bg-white/20 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                                style={{ transitionDelay: `${i * 100 + 200}ms` }}
                            >
                                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                                    <feature.icon size={20} className="text-white" />
                                </div>
                                <h3 className="font-semibold mb-1">{feature.title}</h3>
                                <p className="text-blue-100 text-sm">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className={`w-full max-w-md transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

                    {/* Mobile Logo */}
                    <div className="lg:hidden text-center mb-8">
                        <Image
                            src="/devco-logo-v3.png"
                            alt="DevCo Logo"
                            width={64}
                            height={64}
                            className="rounded-2xl shadow-lg mx-auto mb-4"
                        />
                        <h1 className="text-2xl font-bold text-slate-900">
                            DEVCOERP
                        </h1>
                    </div>

                    {/* Welcome Text */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome back</h2>
                        <p className="text-slate-500">Enter your credentials to access your account</p>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                {error}
                            </div>
                        )}

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                    placeholder="Enter your email"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                    placeholder="Enter password"
                                    required
                                />
                            </div>
                        </div>

                        {/* Remember Me & Forgot */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                <span className="text-sm text-slate-600">Remember me</span>
                            </label>
                            <button type="button" className="text-sm text-blue-600 font-medium hover:text-blue-700">
                                Forgot password?
                            </button>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="60" strokeLinecap="round" className="opacity-30" />
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="60" strokeDashoffset="45" strokeLinecap="round" />
                                    </svg>
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    Sign in
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>



                    {/* Footer */}
                    <p className="text-center text-slate-400 text-sm mt-8">
                        © 2026 DEVCOERP. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    );
}
