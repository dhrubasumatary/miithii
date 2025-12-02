"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  PanelLeftClose, 
  PanelLeft, 
  Plus, 
  MessageSquare, 
  Settings, 
  User,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

const mockHistory = [
  { id: "1", title: "Assamese recipe tips", date: "Today" },
  { id: "2", title: "Life advice from Miithii", date: "Today" },
  { id: "3", title: "Roast session 🔥", date: "Yesterday" },
  { id: "4", title: "Bihu festival info", date: "Yesterday" },
  { id: "5", title: "Guwahati travel guide", date: "Last week" },
];

function SidebarContent({ 
  collapsed, 
  onToggle 
}: { 
  collapsed: boolean; 
  onToggle?: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#30D158] flex items-center justify-center">
            <span className="text-sm font-bold text-black" style={{ fontFamily: 'system-ui' }}>ম</span>
          </div>
          {!collapsed && (
            <span className="font-medium text-[var(--text-primary)]">Miithii</span>
          )}
        </Link>
        {onToggle && (
          <button
            onClick={onToggle}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors"
          >
            {collapsed ? (
              <PanelLeft className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* New Chat */}
      <div className="px-3 pb-2">
        <Link
          href="/chat"
          className={cn(
            "flex items-center gap-3 w-full p-3 rounded-xl",
            "bg-white/[0.04] hover:bg-white/[0.06]",
            "text-[var(--text-primary)] transition-all",
            collapsed ? "justify-center" : ""
          )}
        >
          <Plus className="w-4 h-4" />
          {!collapsed && <span className="text-sm">New Chat</span>}
        </Link>
      </div>

      {/* History */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-2">
        {!collapsed && (
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] px-3 mb-2">
            History
          </p>
        )}
        <div className="space-y-0.5">
          {mockHistory.map((chat) => (
            <button
              key={chat.id}
              className={cn(
                "flex items-center gap-3 w-full p-3 rounded-xl text-left",
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors",
                collapsed ? "justify-center" : ""
              )}
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0" />
              {!collapsed && (
                <span className="text-sm truncate">{chat.title}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 space-y-0.5">
        <button
          className={cn(
            "flex items-center gap-3 w-full p-3 rounded-xl",
            "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors",
            collapsed ? "justify-center" : ""
          )}
        >
          <Settings className="w-4 h-4" />
          {!collapsed && <span className="text-sm">Settings</span>}
        </button>
        <button
          className={cn(
            "flex items-center gap-3 w-full p-3 rounded-xl",
            "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors",
            collapsed ? "justify-center" : ""
          )}
        >
          <User className="w-4 h-4" />
          {!collapsed && <span className="text-sm">Account</span>}
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Desktop */}
      <aside 
        className={cn(
          "hidden md:flex flex-col h-full transition-all duration-300",
          collapsed ? "w-[68px]" : "w-[260px]"
        )}
      >
        <SidebarContent 
          collapsed={collapsed} 
          onToggle={() => setCollapsed(!collapsed)} 
        />
      </aside>

      {/* Mobile */}
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <button className="fixed top-3 left-3 z-50 p-2.5 rounded-xl bg-[var(--bg-secondary)]/95 backdrop-blur-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors shadow-lg border border-white/[0.06]">
              <Menu className="w-5 h-5" />
            </button>
          </SheetTrigger>
          <SheetContent 
            side="left" 
            className="w-[280px] p-0 bg-[var(--bg-secondary)] border-r border-white/[0.04] z-[100]"
          >
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SidebarContent collapsed={false} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
