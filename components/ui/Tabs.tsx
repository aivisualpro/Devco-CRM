import React, { useRef, useState, useEffect, useCallback } from 'react';
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { Switch } from "./switch";

interface Tab {
    id: string;
    label: string;
    icon?: React.ReactNode;
    count?: number;
}

interface TabsProps {
    tabs: Tab[];
    activeTab: string;
    onChange: (tabId: string) => void;
}

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-11 items-center justify-center rounded-full bg-slate-100/70 p-1 text-slate-500 border border-slate-200/50",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-full px-6 py-2 text-sm font-bold ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200/50",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };

export function DataTabs({ tabs, activeTab, onChange }: TabsProps) {
    return (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => onChange(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300
            ${activeTab === tab.id
                            ? 'bg-gradient-to-r from-[#0F4C75] to-[#3282B8] text-white shadow-lg shadow-[#0F4C75]/25'
                            : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-[#0F4C75]/30 hover:text-[#0F4C75]'
                        }`}
                >
                    {tab.icon && <span>{tab.icon}</span>}
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

interface StatusTab {
    id: string;
    label: string;
    count?: number;
}

interface StatusTabsProps {
    tabs: StatusTab[];
    activeTab: string;
    onChange: (tabId: string) => void;
}

// Animated Slider Tabs with sliding pill indicator (like Monthly/Yearly Billing reference)
export function StatusTabs({ tabs, activeTab, onChange, className = '' }: StatusTabsProps & { className?: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
    const [isReady, setIsReady] = useState(false);

    const updateIndicator = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const activeButton = container.querySelector(`[data-tab-id="${activeTab}"]`) as HTMLButtonElement;
        if (!activeButton) return;

        const containerRect = container.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();

        setIndicatorStyle({
            left: buttonRect.left - containerRect.left,
            width: buttonRect.width,
        });
        setIsReady(true);
    }, [activeTab]);

    useEffect(() => {
        const timeout = setTimeout(updateIndicator, 50);
        window.addEventListener('resize', updateIndicator);
        return () => {
            window.removeEventListener('resize', updateIndicator);
            clearTimeout(timeout);
        };
    }, [updateIndicator, tabs]);

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative inline-flex items-center bg-slate-100/80 p-1 rounded-full border border-slate-200/50",
                className
            )}
        >
            {/* Sliding Indicator */}
            <div
                className="absolute top-1 bottom-1 bg-white rounded-full shadow-sm ring-1 ring-slate-950/5"
                style={{
                    left: indicatorStyle.left,
                    width: indicatorStyle.width,
                    opacity: isReady ? 1 : 0,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            />

            {/* Tab Buttons */}
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    data-tab-id={tab.id}
                    onClick={() => onChange(tab.id)}
                    className={cn(
                        "relative z-10 px-6 py-2 text-sm font-bold whitespace-nowrap rounded-full transition-colors duration-200",
                        activeTab === tab.id
                            ? "text-slate-950"
                            : "text-slate-500 hover:text-slate-900"
                    )}
                >
                    {tab.label}
                    {tab.count !== undefined && (
                        <span className={cn(
                            "ml-1.5 font-medium",
                            activeTab === tab.id ? "text-slate-400" : "text-slate-400"
                        )}>
                            ({tab.count})
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}

// Badge Tabs - Pill style with sliding blue background (like your first reference image)
interface BadgeTabsProps {
    tabs: StatusTab[];
    activeTab: string;
    onChange: (tabId: string) => void;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function BadgeTabs({ tabs, activeTab, onChange, size = 'md', className = '' }: BadgeTabsProps) {
    const sizeClasses = {
        sm: 'px-4 py-1.5 text-xs',
        md: 'px-6 py-2.5 text-sm',
        lg: 'px-8 py-3 text-sm',
    };

    return (
        <div
            className={cn(
                "inline-flex items-center gap-1 bg-slate-100/70 p-1 rounded-full border border-slate-200/50 shadow-inner",
                className
            )}
        >
            {tabs.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={cn(
                            "relative z-10 font-bold whitespace-nowrap rounded-full transition-all duration-300",
                            sizeClasses[size],
                            isActive
                                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-950/5"
                                : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/20"
                        )}
                    >
                        {tab.label}
                        {tab.count !== undefined && (
                            <span className={cn(
                                "ml-1.5 font-bold tabular-nums",
                                isActive ? "text-[#0F4C75]" : "text-slate-400"
                            )}>
                                ({tab.count})
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

// Labeled Switch component as seen in the reference image
interface LabeledSwitchProps {
    label: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    className?: string;
}

export function LabeledSwitch({ label, checked, onCheckedChange, className = '' }: LabeledSwitchProps) {
    return (
        <div className={cn(
            "inline-flex items-center gap-4 bg-white px-5 py-2 rounded-full border border-slate-200 shadow-sm transition-all hover:shadow-md",
            className
        )}>
            <span className="text-sm font-bold text-[#0F4C75] tracking-tight">{label}</span>
            <Switch 
                checked={checked} 
                onCheckedChange={onCheckedChange}
                className="data-[state=checked]:bg-[#0F4C75]"
            />
        </div>
    );
}

// Pill Tabs - Blue filled sliding pill (alternative style)
interface PillTabsProps {
    tabs: StatusTab[];
    activeTab: string;
    onChange: (tabId: string) => void;
    size?: 'sm' | 'md' | 'lg';
}

export function PillTabs({ tabs, activeTab, onChange, size = 'md' }: PillTabsProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
    const [isReady, setIsReady] = useState(false);

    const sizeClasses = {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-5 py-2.5 text-sm',
    };

    const updateIndicator = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const activeButton = container.querySelector(`[data-tab-id="${activeTab}"]`) as HTMLButtonElement;
        if (!activeButton) return;

        const containerRect = container.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();

        setIndicatorStyle({
            left: buttonRect.left - containerRect.left,
            width: buttonRect.width,
        });
        setIsReady(true);
    }, [activeTab]);

    useEffect(() => {
        updateIndicator();
        window.addEventListener('resize', updateIndicator);
        return () => window.removeEventListener('resize', updateIndicator);
    }, [updateIndicator, tabs]);

    return (
        <div
            ref={containerRef}
            className="relative inline-flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-full shadow-sm"
        >
            {/* Sliding Gradient Pill */}
            <div
                className="absolute top-1 bottom-1 bg-gradient-to-r from-[#0F4C75] to-[#3282B8] rounded-full shadow-lg shadow-[#0F4C75]/25"
                style={{
                    left: indicatorStyle.left,
                    width: indicatorStyle.width,
                    opacity: isReady ? 1 : 0,
                    transition: 'left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
            />

            {/* Tab Buttons */}
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    data-tab-id={tab.id}
                    onClick={() => onChange(tab.id)}
                    className={`relative z-10 ${sizeClasses[size]} font-medium whitespace-nowrap rounded-full transition-colors duration-200 ${activeTab === tab.id
                        ? 'text-white'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    {tab.label}
                    {tab.count !== undefined && (
                        <span className={`ml-1 ${activeTab === tab.id ? 'text-[#e0f2fe]' : 'text-slate-400'}`}>
                            ({tab.count})
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}

// Underline Tabs with sliding blue underline
interface UnderlineTabsProps {
    tabs: StatusTab[];
    activeTab: string;
    onChange: (tabId: string) => void;
}

export function UnderlineTabs({ tabs, activeTab, onChange }: UnderlineTabsProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
    const [isReady, setIsReady] = useState(false);

    const updateIndicator = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const activeButton = container.querySelector(`[data-tab-id="${activeTab}"]`) as HTMLButtonElement;
        if (!activeButton) return;

        const containerRect = container.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();

        setIndicatorStyle({
            left: buttonRect.left - containerRect.left,
            width: buttonRect.width,
        });
        setIsReady(true);
    }, [activeTab]);

    useEffect(() => {
        updateIndicator();
        window.addEventListener('resize', updateIndicator);
        return () => window.removeEventListener('resize', updateIndicator);
    }, [updateIndicator, tabs]);

    return (
        <div
            ref={containerRef}
            className="relative flex items-center border-b border-slate-200"
        >
            {/* Sliding Underline */}
            <div
                className="absolute bottom-0 h-0.5 bg-[#0F4C75] rounded-full"
                style={{
                    left: indicatorStyle.left,
                    width: indicatorStyle.width,
                    opacity: isReady ? 1 : 0,
                    transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            />

            {/* Tab Buttons */}
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    data-tab-id={tab.id}
                    onClick={() => onChange(tab.id)}
                    className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors duration-200 ${activeTab === tab.id
                        ? 'text-[#0F4C75]'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    {tab.label}
                    {tab.count !== undefined && (
                        <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab.id
                            ? 'bg-[#f0f9ff] text-[#0F4C75]'
                            : 'bg-slate-100 text-slate-400'
                            }`}>
                            {tab.count}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}

// Segmented Control (iOS-style) with sliding indicator
interface SegmentedControlProps {
    tabs: StatusTab[];
    activeTab: string;
    onChange: (tabId: string) => void;
    fullWidth?: boolean;
}

export function SegmentedControl({ tabs, activeTab, onChange, fullWidth = false }: SegmentedControlProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
    const [isReady, setIsReady] = useState(false);

    const updateIndicator = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const activeButton = container.querySelector(`[data-tab-id="${activeTab}"]`) as HTMLButtonElement;
        if (!activeButton) return;

        const containerRect = container.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();

        setIndicatorStyle({
            left: buttonRect.left - containerRect.left,
            width: buttonRect.width,
        });
        setIsReady(true);
    }, [activeTab]);

    useEffect(() => {
        updateIndicator();
        window.addEventListener('resize', updateIndicator);
        return () => window.removeEventListener('resize', updateIndicator);
    }, [updateIndicator, tabs]);

    return (
        <div
            ref={containerRef}
            className={`relative flex items-center bg-slate-100 p-1 rounded-xl ${fullWidth ? 'w-full' : 'inline-flex'}`}
        >
            {/* Sliding White Pill */}
            <div
                className="absolute top-1 bottom-1 bg-white rounded-lg shadow-sm ring-1 ring-slate-200 ring-inset"
                style={{
                    left: indicatorStyle.left,
                    width: indicatorStyle.width,
                    opacity: isReady ? 1 : 0,
                    transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            />

            {/* Tab Buttons */}
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    data-tab-id={tab.id}
                    onClick={() => onChange(tab.id)}
                    className={`relative z-10 flex-1 px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg text-center transition-colors duration-200 ${activeTab === tab.id
                        ? 'text-slate-900'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

// Outlined Tabs - White background with blue border that slides (EXACTLY like Monthly/Yearly Billing reference)
interface OutlinedTabsProps {
    tabs: StatusTab[];
    activeTab: string;
    onChange: (tabId: string) => void;
}

export function OutlinedTabs({ tabs, activeTab, onChange }: OutlinedTabsProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
    const [isReady, setIsReady] = useState(false);

    const updateIndicator = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const activeButton = container.querySelector(`[data-tab-id="${activeTab}"]`) as HTMLButtonElement;
        if (!activeButton) return;

        const containerRect = container.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();

        setIndicatorStyle({
            left: buttonRect.left - containerRect.left,
            width: buttonRect.width,
        });
        setIsReady(true);
    }, [activeTab]);

    useEffect(() => {
        updateIndicator();
        window.addEventListener('resize', updateIndicator);
        return () => window.removeEventListener('resize', updateIndicator);
    }, [updateIndicator, tabs]);

    return (
        <div
            ref={containerRef}
            className="relative inline-flex items-center bg-slate-100 p-1.5 rounded-2xl"
        >
            {/* Sliding Outlined Indicator - bouncy spring animation */}
            <div
                className="absolute top-1.5 bottom-1.5 bg-white rounded-xl border-2 border-[#0F4C75] shadow-sm"
                style={{
                    left: indicatorStyle.left,
                    width: indicatorStyle.width,
                    opacity: isReady ? 1 : 0,
                    transition: 'left 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
            />

            {/* Tab Buttons */}
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    data-tab-id={tab.id}
                    onClick={() => onChange(tab.id)}
                    className={`relative z-10 px-8 py-3 text-sm font-semibold whitespace-nowrap rounded-xl transition-colors duration-200 ${activeTab === tab.id
                        ? 'text-slate-900'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

export default Tabs;
