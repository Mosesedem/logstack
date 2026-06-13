"use client";

import { motion } from "framer-motion";
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  Signal,
  Wifi,
  Battery,
  LayoutGrid,
} from "lucide-react";

const LogstackMobile = () => {
  // Animation Variants
  const containerVars = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } },
  };

  const itemVars = {
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
  };

  const logs = [
    {
      id: 1,
      type: "CRITICAL",
      msg: "DB Connection Timeout",
      time: "2m ago",
      color: "red",
      icon: <ShieldAlert size={14} />,
    },
    {
      id: 2,
      type: "WARN",
      msg: "Rate limit approaching",
      time: "14m ago",
      color: "yellow",
      icon: <AlertTriangle size={14} />,
    },
    {
      id: 3,
      type: "INFO",
      msg: "Worker process started",
      time: "20m ago",
      color: "blue",
      icon: <Info size={14} />,
    },
    {
      id: 4,
      type: "INFO",
      msg: "Deployment successful",
      time: "1h ago",
      color: "blue",
      icon: <Info size={14} />,
    },
  ];

  return (
    <div className="relative group">
      {/* Dynamic Glow Effect */}
      <div className="absolute inset-0 bg-primary/30 blur-[120px] rounded-full opacity-50 group-hover:opacity-80 transition-opacity duration-500" />

      {/* Device Frame */}
      <div className="relative mx-auto border-zinc-900 bg-zinc-900 border-[12px] rounded-[3rem] h-[640px] w-[310px] shadow-2xl overflow-hidden">
        {/* Dynamic Island / Notch */}
        <motion.div
          initial={{ width: 80 }}
          animate={{ width: 120 }}
          className="absolute top-2 left-1/2 -translate-x-1/2 h-7 bg-black rounded-full z-50 flex items-center justify-center"
        >
          <div className="h-2 w-2 rounded-full bg-blue-500/50 blur-[2px]" />
        </motion.div>

        {/* Screen Content */}
        <div className="h-full w-full bg-[#09090b] flex flex-col p-5 pt-12 relative overflow-y-auto no-scrollbar">
          {/* Status Bar */}
          <div className="flex justify-between items-center px-2 mb-8 text-zinc-400">
            <span className="text-xs font-bold">9:41</span>
            <div className="flex gap-1.5 items-center">
              <Signal size={12} />
              <Wifi size={12} />
              <Battery size={12} />
            </div>
          </div>

          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-2xl font-bold text-white tracking-tight">
                Logstack
              </h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
                System Monitor
              </p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center text-primary shadow-inner">
              <LayoutGrid size={20} />
            </div>
          </div>

          {/* Animated Log Feed */}
          <motion.div
            variants={containerVars}
            initial="initial"
            animate="animate"
            className="space-y-4"
          >
            {logs.map((log) => (
              <motion.div
                key={log.id}
                variants={itemVars}
                whileHover={{ scale: 1.02 }}
                className={`p-4 rounded-2xl border backdrop-blur-md transition-all 
                  ${
                    log.color === "red"
                      ? "bg-red-500/10 border-red-500/20"
                      : log.color === "yellow"
                        ? "bg-yellow-500/10 border-yellow-500/20"
                        : "bg-zinc-900/50 border-zinc-800"
                  }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <div
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black
                    ${
                      log.color === "red"
                        ? "bg-red-500/20 text-red-400"
                        : log.color === "yellow"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {log.icon}
                    {log.type}
                  </div>
                  <span className="text-[10px] text-zinc-500 font-medium">
                    {log.time}
                  </span>
                </div>
                <p
                  className={`text-sm font-medium ${log.color === "blue" ? "text-zinc-300" : "text-zinc-100"}`}
                >
                  {log.msg}
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* Bottom Navigation Indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-zinc-800 rounded-full" />
        </div>
      </div>
    </div>
  );
};

export default LogstackMobile;
