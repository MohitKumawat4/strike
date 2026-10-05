"use client";

import { useEffect, useState, useRef } from "react";
import { createSupabaseBrowserClient } from "@/database/supabase/browser";

interface ChatMessage {
  id: string;
  type: "inbound" | "outbound";
  text: string;
  timestamp: Date;
  status?: "sent" | "delivered" | "failed" | "pending" | "accepted";
}

export function WhatsAppPreviewTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    async function loadChat() {
      const db = createSupabaseBrowserClient();
      
      // 1. Fetch inbound (user sent) from system_events
      const { data: inboundData } = await db
        .from("system_events")
        .select("*")
        .eq("event_type", "WHATSAPP_WINDOW_OPENED")
        .order("occurred_at", { ascending: false })
        .limit(20);
        
      // 2. Fetch outbound (strike sent) from delivery_outbox
      const { data: outboundData } = await db
        .from("delivery_outbox")
        .select("id, payload, status, updated_at")
        .order("updated_at", { ascending: false })
        .limit(20);

      const allMessages: ChatMessage[] = [];
      
      inboundData?.forEach((evt: any) => {
        const p = evt.payload as Record<string, any>;
        allMessages.push({
          id: evt.id,
          type: "inbound",
          text: p.inbound_text || "(Clicked Button)",
          timestamp: new Date(evt.occurred_at),
        });
      });
      
      outboundData?.forEach((out: any) => {
        const p = out.payload as Record<string, any>;
        
        let outText = "";
        if (p.summaryText) {
          const isUrgent = (p.importance ?? 0) >= 0.8 || p.category?.toUpperCase() === 'URGENT';
          const headerBadge = isUrgent ? '🚨 *[URGENT EMAIL]*' : '⚡ *[IMPORTANT EMAIL]*';
          outText = `${headerBadge}\n\n`;
          if (p.sender) outText += `👤 *From:* ${p.sender}\n`;
          outText += `📌 *Subject:* ${p.subject}\n`;
          if (p.category) outText += `🏷️ *Category:* ${p.category.toUpperCase()}\n`;
          if (p.gmailLabels?.length > 0) outText += `🗂️ *Labels:* ${p.gmailLabels.join(', ')}\n`;
          outText += `\n📝 *Summary:*\n${p.summaryText}`;
        } else {
          outText = "(Outbound Message - See logs for details)";
        }
        
        allMessages.push({
          id: out.id,
          type: "outbound",
          text: outText,
          timestamp: new Date(out.updated_at),
          status: out.status as ChatMessage["status"],
        });
      });
      
      allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      setMessages(allMessages);
      setLoading(false);
    }
    
    loadChat();
  }, []);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);
  
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="h-[600px] max-w-md mx-auto my-8 bg-[#e5ddd5] rounded-xl overflow-hidden flex flex-col shadow-2xl border border-[var(--border)] relative" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')" }}>
      {/* Header */}
      <div className="bg-[#00a884] p-4 text-white flex items-center gap-3 shadow-md z-10">
        <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-[#00a884] font-bold text-xl overflow-hidden shadow-sm">
          ⚡
        </div>
        <div>
          <h2 className="font-semibold text-lg leading-tight">Strike Intelligence</h2>
          <p className="text-xs opacity-80">AI Inbox Assistant</p>
        </div>
      </div>
      
      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.type === 'inbound' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] rounded-lg p-3 shadow-sm relative text-[15px] leading-snug whitespace-pre-wrap font-sans
                ${msg.type === 'inbound' 
                  ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-none' 
                  : 'bg-white text-[#111b21] rounded-tl-none'}`}
            >
              {msg.text}
              <div className="text-[11px] text-gray-500 text-right mt-1.5 font-medium select-none">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {msg.type === 'outbound' && (
                  <span className="ml-1 inline-block">
                    {msg.status === 'delivered' || msg.status === 'accepted' ? '✓✓' : '✓'}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="bg-[#fff5c4] text-[#85703e] text-sm p-3 rounded-lg text-center mx-auto my-auto shadow-sm max-w-[80%]">
            Messages to this chat and calls are now secured with end-to-end encryption.
          </div>
        )}
      </div>
    </div>
  );
}
