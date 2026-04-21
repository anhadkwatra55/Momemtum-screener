"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SFIcon } from "@/components/ui/sf-icon";
import { AppleButton } from "@/components/ui/apple-button";
import { Card } from "@/components/ui/card";
import { SPRING_TRANSITION_PROPS } from "@/lib/constants";
import { getAuthHeaders } from "@/services/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8060";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setStatus("loading");
    try {
      const res = await fetch(`${API_URL}/api/newsletter/subscribe`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ email }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.message);
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to subscribe.");
      }
    } catch (err) {
      setStatus("error");
      setMessage("Network error. Please try again later.");
    }
  };

  return (
    <Card className="p-6 border border-white/5 bg-gradient-to-br from-[#111111] to-[#0A0A0A] relative overflow-hidden group">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all duration-700 pointer-events-none" />
      
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-purple-400">
          <SFIcon name="envelope.fill" size={16} />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
            The Sunday Quant Report
          </h2>
          <p className="text-xs text-gray-500 tracking-wide mt-0.5">Automated Weekly Market Prep</p>
        </div>
      </div>

      <p className="text-[13px] text-gray-400 leading-relaxed mb-6">
        Every Sunday, the HEADSTART Agent analyzes the past week's options flow and momentum data to deliver the top 3 high-conviction swing setups for Monday morning, straight to your inbox.
      </p>

      <form onSubmit={handleSubmit} className="relative z-10 flex flex-col gap-3">
        <AnimatePresence mode="wait">
          {status === "success" ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3 text-emerald-400 text-sm font-medium"
            >
              <SFIcon name="checkmark.circle.fill" size={16} />
              {message}
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-500">
                  <SFIcon name="at" size={14} />
                </div>
                <input
                  type="email"
                  placeholder="prop-trader@firm.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === "loading"}
                  className="w-full bg-white/5 border border-white/10 text-gray-200 text-sm rounded-xl py-2.5 pl-9 pr-4 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-colors disabled:opacity-50"
                  required
                />
              </div>
              <AppleButton
                variant="primary"
                type="submit"
                disabled={status === "loading"}
                className="whitespace-nowrap px-6 py-2.5 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 hover:text-purple-300 border border-purple-500/30 rounded-xl font-semibold text-sm transition-all"
                glowColor="purple"
              >
                {status === "loading" ? "Subscribing..." : "Join Alpha List"}
              </AppleButton>
            </motion.div>
          )}
        </AnimatePresence>
        
        {status === "error" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-rose-400 text-xs mt-1"
          >
            {message}
          </motion.p>
        )}
      </form>
    </Card>
  );
}
