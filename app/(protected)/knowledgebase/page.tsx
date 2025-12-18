'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/ui';
import {
    BookOpen, Calendar, Clock, ChevronRight, Sparkles,
    Layers, Calculator, FileText, Users, Package, Settings,
    CheckCircle, ArrowUpRight, Tag, History, Zap, Code, MessageSquare
} from 'lucide-react';


// Version changelog data with timestamps
const changelog = [
    {
        version: 'V.0.49',
        date: 'December 18, 2025',
        time: '08:30 PKT',
        type: 'UX & Performance',
        color: 'from-[#6366F1] to-[#A855F7]',
        highlights: [
            'Estimates Table Overhaul',
            'Robust CSV FSM Parser',
            'Dynamic Hex Color Sync',
            'Header Action Integration'
        ],
        changes: [
            {
                category: 'Estimates List & Table',
                items: [
                    'Reordered columns for better flow: Estimate → Total → Status',
                    'Applied hex colors from constants to table badges (Status, Fringe, CP)',
                    'Integrated Proposal Writer profile pictures/initials into table rows',
                    'Implemented natural sort for estimate numbers and robust dates',
                    'Shortened headers for better visibility (Sub, %, Total)'
                ]
            },
            {
                category: 'CSV Import Engine',
                items: [
                    'Built FSM-based parser to correctly handle multi-line and quoted fields',
                    'Added support for Fringe, CP, and Proposal Writer fields during import',
                    'Composite key upserts (Estimate + Version) to prevent data duplication',
                    'Optimized backend client sync using bulk operations'
                ]
            },
            {
                category: 'UI / UX Refinements',
                items: [
                    'Integrated Constants actions (Search/Add) into the global Header',
                    'Removed Eye icon from table actions (click row to view)',
                    'Consistent right-alignment for all currency columns',
                    'Added inline style support to Badge components for hex colors'
                ]
            }
        ]
    },
    {
        version: 'V.0.41',
        date: 'December 18, 2025',
        time: '05:45 PKT',
        type: 'Major Update',
        color: 'from-[#0ea5e9] to-[#2563eb]',
        highlights: [
            'Employee Profile Pictures',
            'Cloudinary Integration',
            'Visual Proposal Writer',
            'List Pagination Fix'
        ],
        changes: [
            {
                category: 'Profile Pictures & Branding',
                items: [
                    'Integrated Cloudinary for secure, optimized image storage',
                    'Smart face-detection cropping for perfection profile photos',
                    'Fallback Initials Avatar: Automatically generated when no photo exists',
                    'Visual Proposal Writer: Selector now shows faces/avatars instead of generic icons'
                ]
            },
            {
                category: 'Employee Management',
                items: [
                    'Added visual avatar column to Employee List',
                    'Refined phone number formatting (xxx xxx xxxx)',
                    'Fixed Pagination Bug: Search filters now correctly reset page to 1',
                    'Fixed Interaction Bug: Edit/Delete buttons no longer trigger row navigation'
                ]
            }
        ]
    },
    {
        version: 'V.0.37',
        date: 'December 18, 2025',
        time: '03:00 PKT',
        type: 'Feature Release',
        color: 'from-[#4F46E5] to-[#6366F1]',
        highlights: [
            'Devco Communication System',
            'Floating Chat Widget',
            'Real-time Messaging',
            'Channel Management'
        ],
        changes: [
            {
                category: 'Communication Infrastructure',
                items: [
                    'Built unified /api/communication for message & channel management',
                    'Created Message and Channel schemas in MongoDB',
                    'Dedicated DevcoCommunicationDb collection structure'
                ]
            },
            {
                category: 'Chat UI Components',
                items: [
                    'Sleek floating Chat Widget with pulse notifications',
                    'Unified Chat Modal with Estimates, Channels, and Employees sidebar',
                    'Searchable conversation filtering',
                    'Glassmorphic design with Indigo theme consistency'
                ]
            },
            {
                category: 'Features',
                items: [
                    'One-click custom channel creation',
                    'Direct messaging with colleagues',
                    'Proposal-specific discussion threads',
                    'Historical message persistence with timestamps'
                ]
            }
        ]
    },

    {
        version: 'V.0.32',
        date: 'December 17, 2025',
        time: '20:00 PKT',
        type: 'UI Overhaul',
        color: 'from-[#0066FF] to-[#3385FF]',
        highlights: [
            'Dynamic Header Buttons with visual feedback',
            'Liquid fill animation for Markup %',
            'Fringe Rate MongoDB fix',
            'AppSheet sync temporarily disabled'
        ],
        changes: [
            {
                category: 'Dynamic Header Buttons',
                items: [
                    'Services Button: Shows count of selected services on #0066FF blue background',
                    'Status Button: Background fills with reference color; icon turns white',
                    'Markup % Button: Displays percentage with liquid fill animation',
                    'Fringe Rate Button: Background fills with reference color when selected'
                ]
            },
            {
                category: 'Bug Fixes',
                items: [
                    'Fixed Fringe Rate not saving to MongoDB',
                    'Resolved click-outside handler interference with dropdown',
                    'Implemented dedicated handleFringeChange handler'
                ]
            },
            {
                category: 'UI Polish',
                items: [
                    'Added Percent and HardHat icons from lucide-react',
                    'Aligned all header buttons in consistent 2x2 grid',
                    'Added CSS keyframe animation: liquidRise'
                ]
            }
        ]
    },
    {
        version: 'V.0.31',
        date: 'December 17, 2025',
        time: '14:30 PKT',
        type: 'Feature Release',
        color: 'from-[#0052CC] to-[#0066FF]',
        highlights: [
            'Project Name field added',
            'Auto-populate client information',
            'Clone estimates feature',
            'Default 30% Markup'
        ],
        changes: [
            {
                category: 'Estimate Enhancements',
                items: [
                    'Added editable Project Name field to Estimate Header',
                    'Address & Contact Sync: Auto-fills Job Address and Key Contact',
                    'Clone button replaces New button for version creation (V2, V3)',
                    'AutoFocus on all Add Item search bars',
                    'Right-aligned numerical columns',
                    'Default Markup set to 30%'
                ]
            },
            {
                category: 'Calculation Updates',
                items: [
                    'Equipment: Added Delivery & Pickup field (Default: $300)',
                    'Equipment Formula: (Qty × Times × Cost) + (Qty × Fuel) + (Qty × Delivery)',
                    'Overhead: Hours = Days × 8',
                    'Fixed Times field persistence issue'
                ]
            },
            {
                category: 'Client Management',
                items: [
                    'Related Contacts dashboard on Client Page',
                    'Key Contact flag for intelligent auto-selection'
                ]
            }
        ]
    }
];

// Module overview
const modules = [
    {
        name: 'Estimates Management',
        icon: Calculator,
        description: 'Core engine for project costing and tracking',
        color: 'text-orange-500',
        bgColor: 'bg-orange-50',
        features: ['Dashboard', 'Smart Versioning', 'Interactive Calculator', 'Legacy Sync']
    },
    {
        name: 'Proposal & Templates',
        icon: FileText,
        description: 'Turn estimates into professional documents',
        color: 'text-indigo-500',
        bgColor: 'bg-indigo-50',
        features: ['Rich Text Editor', 'Dynamic Variables', 'PDF Export', 'Snapshotting']
    },
    {
        name: 'Catalogue System',
        icon: Package,
        description: 'Centralized database for all cost items',
        color: 'text-blue-500',
        bgColor: 'bg-blue-50',
        features: ['CRUD Support', 'Categorization', 'Instant Search', 'Bulk Import']
    },
    {
        name: 'CRM',
        icon: Users,
        description: 'Client and contact management',
        color: 'text-cyan-500',
        bgColor: 'bg-cyan-50',
        features: ['Client Dashboard', 'Contact Management', 'Key Contacts', 'Auto-populate']
    },
    {
        name: 'Communication',
        icon: MessageSquare,
        description: 'Real-time internal chat system',
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        features: ['Floating Widget', 'Proposal Chats', 'Group Channels', 'Direct Messaging']
    }
];


export default function KnowledgebasePage() {
    const [mounted, setMounted] = useState(false);
    const [activeVersion, setActiveVersion] = useState(changelog[0].version);

    useEffect(() => {
        setMounted(true);
    }, []);

    const activeChangelog = changelog.find(c => c.version === activeVersion) || changelog[0];

    return (
        <>
            <Header showDashboardActions={true} />
            <div className="min-h-screen bg-[#f8fafc]">
                <div className="max-w-[1400px] mx-auto px-6 py-8">

                    {/* Hero Section */}
                    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0066FF] via-[#3385FF] to-[#0052CC] p-8 md:p-12 mb-8 ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
                        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#002966]/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                                        <BookOpen className="w-8 h-8 text-white" />
                                    </div>
                                    <div>
                                        <h1 className="text-3xl md:text-4xl font-bold text-white">
                                            Knowledgebase & Documentation
                                        </h1>
                                        <p className="text-blue-100 mt-1">DevCo CRM - Complete System Reference</p>
                                    </div>
                                </div>
                                <p className="text-blue-100 max-w-2xl">
                                    Everything you need to know about the DevCo CRM system. Browse modules, explore features,
                                    and track all changes through our detailed changelog.
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-center px-6 py-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
                                    <p className="text-4xl font-bold text-white">{changelog[0].version}</p>
                                    <p className="text-blue-100 text-sm mt-1">Current Version</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Module Overview */}
                    <div className={`mb-8 ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '100ms' }}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-[#E5F0FF] rounded-lg">
                                <Layers className="w-5 h-5 text-[#0066FF]" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">Modules & Functionalities</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            {modules.map((module, i) => (
                                <div
                                    key={module.name}
                                    className={`bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all group ${mounted ? 'animate-scale-in' : 'opacity-0'}`}
                                    style={{ animationDelay: `${200 + i * 50}ms` }}
                                >
                                    <div className={`w-12 h-12 ${module.bgColor} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                        <module.icon className={`w-6 h-6 ${module.color}`} />
                                    </div>
                                    <h3 className="font-bold text-slate-900 mb-1">{module.name}</h3>
                                    <p className="text-xs text-slate-500 mb-3">{module.description}</p>
                                    <div className="flex flex-wrap gap-1">
                                        {module.features.slice(0, 3).map(f => (
                                            <span key={f} className="text-[10px] px-2 py-0.5 bg-slate-50 rounded-full text-slate-500">{f}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Changelog Section */}
                    <div className={`${mounted ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '300ms' }}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-[#E5F0FF] rounded-lg">
                                <History className="w-5 h-5 text-[#0066FF]" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">Changelog</h2>
                        </div>

                        <div className="grid grid-cols-12 gap-6">
                            {/* Version Sidebar */}
                            <div className="col-span-12 lg:col-span-3">
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sticky top-24">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Versions</h3>
                                    <div className="space-y-2">
                                        {changelog.map((entry) => (
                                            <button
                                                key={entry.version}
                                                onClick={() => setActiveVersion(entry.version)}
                                                className={`w-full text-left p-3 rounded-xl transition-all ${activeVersion === entry.version
                                                    ? 'bg-gradient-to-r from-[#E5F0FF] to-[#CCE0FF] border border-[#99C2FF]'
                                                    : 'hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className={`font-bold ${activeVersion === entry.version ? 'text-[#0066FF]' : 'text-slate-700'}`}>
                                                        {entry.version}
                                                    </span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${activeVersion === entry.version
                                                        ? 'bg-[#0066FF] text-white'
                                                        : 'bg-slate-100 text-slate-500'
                                                        }`}>
                                                        {entry.type}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                                                    <Calendar size={12} />
                                                    <span>{entry.date}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Changelog Detail */}
                            <div className="col-span-12 lg:col-span-9">
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                    {/* Version Header */}
                                    <div className={`bg-gradient-to-r ${activeChangelog.color} p-6`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-3xl font-bold text-white">{activeChangelog.version}</span>
                                                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium text-white backdrop-blur-sm">
                                                        {activeChangelog.type}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 mt-2 text-blue-100">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={14} /> {activeChangelog.date}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={14} /> {activeChangelog.time}
                                                    </span>
                                                </div>
                                            </div>
                                            <Sparkles className="w-12 h-12 text-white/30" />
                                        </div>

                                        {/* Highlights */}
                                        <div className="flex flex-wrap gap-2 mt-4">
                                            {activeChangelog.highlights.map((h, i) => (
                                                <span key={i} className="px-3 py-1 bg-white/10 rounded-full text-sm text-white backdrop-blur-sm border border-white/20">
                                                    {h}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Changes Detail */}
                                    <div className="p-6">
                                        <div className="space-y-6">
                                            {activeChangelog.changes.map((section, i) => (
                                                <div key={i}>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <div className="w-2 h-2 rounded-full bg-[#0066FF]" />
                                                        <h4 className="font-bold text-slate-800">{section.category}</h4>
                                                    </div>
                                                    <ul className="space-y-2 pl-4">
                                                        {section.items.map((item, j) => (
                                                            <li key={j} className="flex items-start gap-3 text-sm text-slate-600">
                                                                <CheckCircle size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                                                <span>{item}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className={`mt-12 text-center ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '400ms' }}>
                        <p className="text-slate-400 text-sm">
                            Built with ❤️ using Next.js 15, MongoDB, and TailwindCSS
                        </p>
                    </div>

                </div>
            </div>
        </>
    );
}
