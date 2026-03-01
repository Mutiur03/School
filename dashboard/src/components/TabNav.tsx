import React from "react";
import { Link, useLocation } from "react-router-dom";

export interface TabItem {
    id: string;
    label: string;
    icon?: React.ReactNode;
    badge?: string | number;
    /**
     * Optional URL (path + search/hash). When provided the tab renders as a
     * `<Link>` that changes the URL when clicked. Active state is determined by
     * an exact match of the current `pathname + search` against this value,
     * enabling direct deep-links / bookmarkable tabs.
     *
     * Example: `"/registration/class-6?tab=settings"`
     */
    href?: string;
}

interface TabNavProps {
    tabs: TabItem[];
    activeTab: string;
    onTabChange: (id: string) => void;
    className?: string;
}

const activeClass = "text-blue-600 border-b-2 border-blue-600";
const inactiveClass =
    "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200";

/**
 * Reusable horizontal tab navigation bar.
 *
 * Tabs without `href` behave as controlled buttons (use `activeTab` / `onTabChange`).
 * Tabs with `href` render as `<Link>` — clicking changes the URL. Active state is
 * determined by an exact match of the current URL (pathname + search) so search-param
 * based tabs highlight correctly.
 *
 * Usage:
 * ```tsx
 * const tabs: TabItem[] = [
 *   { id: "registrations", label: "Registrations", icon: <Users size={16} />, href: "/registration/class-6?tab=registrations" },
 *   { id: "settings",      label: "Settings",      icon: <Settings size={16} />, href: "/registration/class-6?tab=settings" },
 * ];
 *
 * <TabNav tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
 * ```
 */
const TabNav: React.FC<TabNavProps> = ({ tabs, activeTab, onTabChange, className = "" }) => {
    const location = useLocation();
    const currentUrl = location.pathname + location.search;

    return (
        <div className={`flex gap-4 border-b border-gray-200 dark:border-gray-700 ${className}`}>
            {tabs.map((tab) => {
                const inner = (
                    <div className="flex items-center gap-2">
                        {tab.icon}
                        {tab.label}
                        {tab.badge !== undefined && (
                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                {tab.badge}
                            </span>
                        )}
                    </div>
                );

                if (tab.href) {
                    const isActive = currentUrl === tab.href;
                    return (
                        <Link
                            key={tab.id}
                            to={tab.href}
                            onClick={() => onTabChange(tab.id)}
                            className={`pb-2 px-1 text-sm font-medium transition-colors relative ${isActive ? activeClass : inactiveClass
                                }`}
                        >
                            {inner}
                        </Link>
                    );
                }

                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`pb-2 px-1 text-sm font-medium transition-colors relative ${activeTab === tab.id ? activeClass : inactiveClass
                            }`}
                    >
                        {inner}
                    </button>
                );
            })}
        </div>
    );
};

export default TabNav;
