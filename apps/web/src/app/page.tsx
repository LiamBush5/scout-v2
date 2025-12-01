'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  Zap,
  GitBranch,
  MessageSquare,
  Shield,
  BarChart3,
  Terminal
} from 'lucide-react'

function Radar() {
  // Blip positions and their calculated angular delays
  // Scanner does 360° in 4s, starts at 3 o'clock (0°) going clockwise
  // Angle = atan2(top-50, left-50), delay = (angle / 360) * 4s
  const blips = [
    { top: '60%', left: '78%', size: 'w-2.5 h-2.5', delay: '0.22s' },  // 20° clockwise
    { top: '75%', left: '60%', size: 'w-3 h-3', delay: '0.76s' },      // 68° clockwise
    { top: '65%', left: '35%', size: 'w-2.5 h-2.5', delay: '1.5s' },   // 135° clockwise
    { top: '30%', left: '25%', size: 'w-2 h-2', delay: '2.43s' },      // 219° clockwise
    { top: '25%', left: '70%', size: 'w-3 h-3', delay: '3.43s' },      // 309° clockwise
    { top: '35%', left: '80%', size: 'w-3 h-3', delay: '3.70s' },      // 333° clockwise
  ]

  return (
    <div className="absolute inset-0 flex items-start justify-center pointer-events-none -top-20">
      <div className="relative w-[900px] h-[900px]">
        {/* Radar circles */}
        <div className="absolute inset-0 rounded-full border-2 border-primary/40" />
        <div className="absolute inset-[112px] rounded-full border border-primary/35" />
        <div className="absolute inset-[224px] rounded-full border border-primary/30" />
        <div className="absolute inset-[336px] rounded-full border border-primary/25" />

        {/* Cross lines */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-primary/30" />
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-primary/30" />

        {/* Diagonal lines */}
        <div className="absolute top-0 left-0 right-0 bottom-0 rotate-45">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-primary/20" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-primary/20" />
        </div>

        {/* Single scanner - sweep with trail */}
        <div
          className="absolute top-1/2 left-1/2 origin-left animate-radar-scan"
          style={{
            width: '50%',
            height: '100%',
            marginTop: '-50%',
            background: 'conic-gradient(from -90deg at 0% 50%, transparent 0deg, hsl(var(--primary) / 0.4) 0deg, hsl(var(--primary) / 0.15) 40deg, transparent 80deg)',
          }}
        />

        {/* Scanner beam line */}
        <div
          className="absolute top-1/2 left-1/2 w-1/2 h-0.5 origin-left animate-radar-scan"
          style={{
            background: 'linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.6) 40%, transparent 100%)',
            boxShadow: '0 0 15px 2px hsl(var(--primary) / 0.5)',
          }}
        />

        {/* Blips - flash when scanner passes */}
        {blips.map((blip, i) => (
          <div
            key={i}
            className={`absolute ${blip.size} rounded-full bg-primary animate-radar-blip`}
            style={{
              top: blip.top,
              left: blip.left,
              animationDelay: blip.delay,
              boxShadow: '0 0 12px 4px hsl(var(--primary) / 0.6)',
            }}
          />
        ))}

        {/* Center dot */}
        <div className="absolute top-1/2 left-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_15px_4px_hsl(var(--primary)/0.5)]" />
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Radar Animation Styles */}
      <style jsx global>{`
        @keyframes radar-scan {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes radar-blip {
          0%, 100% {
            opacity: 0;
            transform: scale(0.5);
          }
          2% {
            opacity: 1;
            transform: scale(1.2);
          }
          5% {
            opacity: 1;
            transform: scale(1);
          }
          15% {
            opacity: 0.4;
            transform: scale(1);
          }
          30% {
            opacity: 0;
            transform: scale(0.8);
          }
        }

        .animate-radar-scan {
          animation: radar-scan 4s linear infinite;
        }

        .animate-radar-blip {
          animation: radar-blip 4s ease-in-out infinite;
        }
      `}</style>

      {/* Navigation - Cursor style */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-center relative">
          {/* Logo - absolute left */}
          <Link href="/" className="absolute left-6 flex items-center">
            <span className="font-semibold text-[14px] text-white tracking-tight">Scout</span>
          </Link>

          {/* Center Nav - centered */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-[13px] text-[#888] hover:text-white transition-colors">
              Features
            </Link>
            <Link href="#demo" className="text-[13px] text-[#888] hover:text-white transition-colors">
              Demo
            </Link>
            <Link href="#pricing" className="text-[13px] text-[#888] hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/docs" className="text-[13px] text-[#888] hover:text-white transition-colors">
              Docs
            </Link>
          </div>

          {/* Right Actions - absolute right */}
          <div className="absolute right-6 flex items-center gap-3">
            <Link href="/login" className="text-[13px] text-[#888] hover:text-white transition-colors">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-[13px] text-white px-3 py-1 rounded-md border border-[#333] hover:border-[#555] hover:bg-[#111] transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        {/* Radar background - positioned to flow into next section */}
        <div className="absolute inset-0 -bottom-40">
          <Radar />
        </div>

        {/* Gradient overlay - fades top, transparent middle, subtle fade at bottom */}
        <div className="absolute inset-0 -bottom-40 bg-gradient-to-b from-background via-transparent to-transparent pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card/50 text-sm text-muted-foreground mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Now with Grok 4.1 for faster investigations
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            Your AI
            <span className="text-primary"> SRE </span>
            that never sleeps
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Scout automatically investigates production incidents, correlates deployments with issues, and reports findings to your team in minutes, not hours.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/signup">
              <Button size="lg" className="h-12 px-8 text-base">
                Start for free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="#demo">
              <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                See it in action
              </Button>
            </Link>
          </div>

          {/* 3-click setup */}
          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
            <span className="text-[13px]">Connect</span>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-card border border-border text-foreground text-[13px]">Datadog</span>
              <span className="text-muted-foreground/50">→</span>
              <span className="px-2.5 py-1 rounded bg-card border border-border text-foreground text-[13px]">GitHub</span>
              <span className="text-muted-foreground/50">→</span>
              <span className="px-2.5 py-1 rounded bg-card border border-border text-foreground text-[13px]">Slack</span>
            </div>
            <span className="text-[13px] text-muted-foreground/70">· 5 min</span>
          </div>

        </div>
      </section>

      {/* Live Demo Terminal */}
      <section id="demo" className="relative pt-10 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xl shadow-black/20">
            {/* Terminal header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/70" />
                <div className="w-3 h-3 rounded-full bg-warning/70" />
                <div className="w-3 h-3 rounded-full bg-primary/70" />
              </div>
              <span className="text-xs text-muted-foreground ml-2 font-mono">scout-investigation-12847</span>
            </div>

            {/* Terminal content */}
            <div className="p-6 font-mono text-sm space-y-4 bg-[hsl(60,3%,6%)]">
              <div className="flex items-start gap-3">
                <Terminal className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <span className="text-primary">Alert received:</span>
                  <span className="text-muted-foreground"> High error rate on </span>
                  <span className="text-foreground">api-gateway</span>
                  <span className="text-muted-foreground"> (15.2% → threshold 5%)</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Zap className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div>
                  <span className="text-warning">Investigating...</span>
                  <span className="text-muted-foreground"> Checking recent deployments</span>
                </div>
              </div>

              <div className="flex items-start gap-3 pl-7">
                <div className="text-muted-foreground">
                  Found deployment <span className="text-foreground">a3f8c21</span> deployed <span className="text-destructive">23 min ago</span> by @sarah
                </div>
              </div>

              <div className="flex items-start gap-3">
                <GitBranch className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-blue-400">Analyzing commit:</span>
                  <span className="text-muted-foreground"> Modified </span>
                  <span className="text-foreground">database/connection.py</span>
                  <span className="text-destructive"> (high-risk file)</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <BarChart3 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <span className="text-primary">Datadog metrics:</span>
                  <span className="text-muted-foreground"> DB connection pool exhausted at </span>
                  <span className="text-foreground">14:32 UTC</span>
                </div>
              </div>

              <div className="border-t border-border pt-4 mt-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <span className="text-primary font-semibold">Root cause identified</span>
                    <span className="text-muted-foreground"> (confidence: </span>
                    <span className="text-primary">HIGH</span>
                    <span className="text-muted-foreground">)</span>
                    <div className="mt-2 text-foreground">
                      Connection pool size reduced in commit a3f8c21 from 100 → 10.
                      <br />
                      <span className="text-muted-foreground">Recommended action:</span> Revert or increase pool size.
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MessageSquare className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-green-400">Posted to #incidents</span>
                  <span className="text-muted-foreground"> with findings and rollback command</span>
                </div>
              </div>

              <div className="text-muted-foreground text-xs mt-4 pt-4 border-t border-border">
                Investigation completed in <span className="text-primary">2m 34s</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Showcase */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-6">

            {/* 1. Starts in Seconds */}
            <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-primary/10">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-[14px] text-white font-medium">Starts in Seconds</span>
                </div>
                <span className="text-[12px] text-primary font-mono">0.8s</span>
              </div>
              <div className="px-5 pt-4 pb-2">
                <p className="text-[13px] text-[#666] leading-relaxed">
                  Investigation begins automatically when alerts fire. No on-call engineer needed to kick it off.
                </p>
              </div>
              <div className="p-5 pt-2">
                <div className="relative">
                  <div className="absolute left-3 top-0 bottom-0 w-px bg-[#1a1a1a]" />
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 pl-0">
                      <div className="w-6 h-6 rounded-full bg-destructive/20 border-2 border-destructive flex items-center justify-center z-10">
                        <div className="w-2 h-2 rounded-full bg-destructive" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[12px] text-white">Alert triggered</div>
                        <div className="text-[11px] text-[#555]">14:32:00 UTC</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 pl-0">
                      <div className="w-6 h-6 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center z-10">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[12px] text-white">Scout activated</div>
                        <div className="text-[11px] text-primary">+0.8s</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 pl-0">
                      <div className="w-6 h-6 rounded-full bg-primary/30 border-2 border-primary flex items-center justify-center z-10">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[12px] text-white">Investigation complete</div>
                        <div className="text-[11px] text-primary">+2m 34s</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Queries Datadog Automatically */}
            <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-primary/10">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-[14px] text-white font-medium">Queries Datadog Automatically</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  <span className="text-[12px] text-primary">Live</span>
                </div>
              </div>
              <div className="px-5 pt-4 pb-2">
                <p className="text-[13px] text-[#666] leading-relaxed">
                  Pulls metrics, logs, and APM traces the moment an alert fires. No manual digging required.
                </p>
              </div>
              <div className="p-5 pt-2 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] text-[#888]">Error Rate</span>
                    <span className="text-[13px] text-destructive font-mono">15.2%</span>
                  </div>
                  <div className="h-8 flex items-end gap-px">
                    {[2, 3, 2, 4, 3, 5, 4, 6, 8, 12, 18, 25, 35, 48, 62, 58, 52, 45, 38, 32].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm"
                        style={{
                          height: `${h}%`,
                          background: h > 30 ? '#ef4444' : '#333'
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] text-[#888]">DB Connections</span>
                    <span className="text-[13px] text-primary font-mono">10/10</span>
                  </div>
                  <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div className="h-full w-full bg-gradient-to-r from-primary to-primary/50 rounded-full" />
                  </div>
                  <div className="text-[11px] text-primary mt-1">Pool exhausted</div>
                </div>
              </div>
            </div>

            {/* 3. Correlates Deployments */}
            <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-primary/10">
                    <GitBranch className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-[14px] text-white font-medium">Correlates Deployments</span>
                </div>
                <span className="text-[12px] text-[#888] font-mono">a3f8c21</span>
              </div>
              <div className="px-5 pt-4 pb-2">
                <p className="text-[13px] text-[#666] leading-relaxed">
                  Identifies which commits shipped before the incident and flags high-risk file changes.
                </p>
              </div>
              <div className="p-4 pt-2 font-mono text-[12px] leading-relaxed">
                <div className="flex items-center gap-2 mb-3 text-[#888]">
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1a1a1a]">database/connection.py</span>
                  <span className="text-destructive text-[11px]">HIGH RISK</span>
                </div>
                <div className="space-y-0.5 bg-[#0d0d0d] rounded-lg p-3 border border-[#1a1a1a]">
                  <div className="text-[#555]">  <span className="text-[#444] select-none">14</span>  class ConnectionPool:</div>
                  <div className="text-[#555]">  <span className="text-[#444] select-none">15</span>      def __init__(self):</div>
                  <div className="bg-red-500/10 text-red-400 -mx-3 px-3">  <span className="text-red-400/50 select-none">16</span>-         self.max_size = 100</div>
                  <div className="bg-primary/10 text-primary -mx-3 px-3">  <span className="text-primary/50 select-none">16</span>+         self.max_size = 10</div>
                  <div className="text-[#555]">  <span className="text-[#444] select-none">17</span>          self.timeout = 30</div>
                  <div className="text-[#555]">  <span className="text-[#444] select-none">18</span>          self.retry_count = 3</div>
                </div>
                <div className="mt-3 flex items-center gap-4 text-[11px]">
                  <span className="text-[#888]">@sarah · 23 min ago</span>
                  <span className="text-primary">● Correlates with error spike</span>
                </div>
              </div>
            </div>

            {/* 4. Identifies Root Cause */}
            <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-primary/10">
                    <Shield className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-[14px] text-white font-medium">Identifies Root Cause</span>
                </div>
                <span className="text-[12px] text-primary font-mono">89% accuracy</span>
              </div>
              <div className="px-5 pt-4 pb-2">
                <p className="text-[13px] text-[#666] leading-relaxed">
                  Surfaces the most likely cause with supporting evidence from logs, metrics, and code changes.
                </p>
              </div>
              <div className="p-5 pt-2">
                {/* Convergence visualization */}
                <div className="relative h-32 mb-4">
                  <svg className="w-full h-full" viewBox="0 0 240 100">
                    {/* Connecting lines from sources to center */}
                    <path d="M30,20 Q80,20 120,50" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.6" className="animate-pulse" style={{ animationDelay: '0s' }} />
                    <path d="M30,50 Q80,50 120,50" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.8" className="animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <path d="M30,80 Q80,80 120,50" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.7" className="animate-pulse" style={{ animationDelay: '0.4s' }} />

                    {/* Source nodes */}
                    <circle cx="30" cy="20" r="18" fill="#0a0a0a" stroke="#1a1a1a" strokeWidth="2" />
                    <circle cx="30" cy="20" r="12" fill="#1a1a1a" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.5" />
                    <text x="30" y="24" textAnchor="middle" className="fill-primary text-[8px] font-mono">92%</text>

                    <circle cx="30" cy="50" r="18" fill="#0a0a0a" stroke="#1a1a1a" strokeWidth="2" />
                    <circle cx="30" cy="50" r="12" fill="#1a1a1a" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.7" />
                    <text x="30" y="54" textAnchor="middle" className="fill-primary text-[8px] font-mono">87%</text>

                    <circle cx="30" cy="80" r="18" fill="#0a0a0a" stroke="#1a1a1a" strokeWidth="2" />
                    <circle cx="30" cy="80" r="12" fill="#1a1a1a" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.6" />
                    <text x="30" y="84" textAnchor="middle" className="fill-primary text-[8px] font-mono">95%</text>

                    {/* Center target rings */}
                    <circle cx="120" cy="50" r="28" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.2" />
                    <circle cx="120" cy="50" r="20" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.3" />
                    <circle cx="120" cy="50" r="12" fill="hsl(var(--primary))" opacity="0.2" />
                    <circle cx="120" cy="50" r="6" fill="hsl(var(--primary))" className="animate-pulse" />

                    {/* Output arrow */}
                    <path d="M150,50 L200,50" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
                    <path d="M195,45 L205,50 L195,55" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Result box */}
                    <rect x="205" y="35" width="30" height="30" rx="4" fill="#1a1a1a" stroke="hsl(var(--primary))" strokeWidth="1.5" />
                    <text x="220" y="54" textAnchor="middle" className="fill-primary text-[9px] font-bold">HIGH</text>
                  </svg>

                  {/* Labels */}
                  <div className="absolute left-0 top-0 h-full flex flex-col justify-between py-1 text-[9px] text-[#555]">
                    <span className="pl-12">Metrics</span>
                    <span className="pl-12">Logs</span>
                    <span className="pl-12">Code</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#1a1a1a]">
                  <div className="flex items-center gap-2 text-[12px]">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-white">Root cause identified</span>
                  </div>
                  <div className="mt-2 text-[11px] text-[#555] pl-4">
                    connection_pool.max_size reduced 100 → 10
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Reports to Slack */}
            <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-primary/10">
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-[14px] text-white font-medium">Reports to Slack</span>
                </div>
                <span className="text-[12px] text-[#888]">#incidents</span>
              </div>
              <div className="px-5 pt-4 pb-2">
                <p className="text-[13px] text-[#666] leading-relaxed">
                  Posts findings with confidence levels and recommended actions directly to your incident channel.
                </p>
              </div>
              <div className="p-5 pt-2">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] text-white font-semibold">Scout</span>
                      <span className="text-[11px] text-[#555] bg-[#1a1a1a] px-1.5 py-0.5 rounded">APP</span>
                      <span className="text-[11px] text-[#555]">2:34 PM</span>
                    </div>
                    <div className="text-[13px] text-[#ccc] leading-relaxed">
                      <span className="text-primary font-medium">Root cause found</span> for api-gateway alert
                    </div>
                    <div className="mt-3 p-3 rounded-lg border-l-2 border-primary bg-[#0d0d0d]">
                      <div className="text-[12px] text-white mb-1">Connection pool reduced 100 → 10</div>
                      <div className="text-[11px] text-[#888]">Commit a3f8c21 by @sarah · Confidence: HIGH</div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button className="px-3 py-1.5 rounded-md bg-primary/20 text-[12px] text-primary hover:bg-primary/30 transition-colors">
                        Revert commit
                      </button>
                      <button className="px-3 py-1.5 rounded-md bg-[#1a1a1a] text-[12px] text-[#888] hover:bg-[#222] transition-colors">
                        View details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Learns Your Stack */}
            <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-primary/10">
                    <Terminal className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-[14px] text-white font-medium">Learns Your Stack</span>
                </div>
                <span className="text-[12px] text-primary font-mono">89.2%</span>
              </div>
              <div className="px-5 pt-4 pb-2">
                <p className="text-[13px] text-[#666] leading-relaxed">
                  Improves over time with team feedback. Remembers your architecture and common failure modes.
                </p>
              </div>
              <div className="p-5 pt-2">
                {/* Confidence graph trending upward */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[12px] text-[#888]">Model Confidence</span>
                    <span className="text-[12px] text-primary">↑ 23% this month</span>
                  </div>
                  <div className="relative h-24">
                    <svg className="w-full h-full" viewBox="0 0 200 80" preserveAspectRatio="none">
                      {/* Grid lines */}
                      <line x1="0" y1="20" x2="200" y2="20" stroke="#1a1a1a" strokeWidth="1" />
                      <line x1="0" y1="40" x2="200" y2="40" stroke="#1a1a1a" strokeWidth="1" />
                      <line x1="0" y1="60" x2="200" y2="60" stroke="#1a1a1a" strokeWidth="1" />
                      {/* Area fill */}
                      <path
                        d="M0,65 L14,62 L28,58 L42,54 L56,50 L70,45 L84,38 L98,32 L112,28 L126,22 L140,18 L154,14 L168,11 L182,9 L200,7 L200,80 L0,80 Z"
                        fill="url(#gradient)"
                        opacity="0.3"
                      />
                      {/* Line */}
                      <path
                        d="M0,65 L14,62 L28,58 L42,54 L56,50 L70,45 L84,38 L98,32 L112,28 L126,22 L140,18 L154,14 L168,11 L182,9 L200,7"
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* End dot */}
                      <circle cx="200" cy="7" r="4" fill="hsl(var(--primary))" />
                      {/* Gradient definition */}
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="hsl(var(--primary))" />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                    </svg>
                    {/* Y-axis labels */}
                    <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[9px] text-[#444] -ml-1">
                      <span>100%</span>
                      <span>50%</span>
                      <span>0%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#444] font-mono mt-2 pl-4">
                    <span>Week 1</span>
                    <span>Week 8</span>
                    <span>Week 15</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-[#1a1a1a] grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-[14px] text-primary font-semibold">2,847</div>
                    <div className="text-[10px] text-[#555]">Patterns</div>
                  </div>
                  <div>
                    <div className="text-[14px] text-primary font-semibold">156</div>
                    <div className="text-[10px] text-[#555]">Services</div>
                  </div>
                  <div>
                    <div className="text-[14px] text-primary font-semibold">89</div>
                    <div className="text-[10px] text-[#555]">Failure modes</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-8 py-8 border-t border-[#1a1a1a]">
            <div>
              <h2 className="text-xl font-medium text-white mb-1">
                Stop fighting fires manually
              </h2>
              <p className="text-[14px] text-[#666]">
                Teams resolve incidents 73% faster with Scout.
              </p>
            </div>
            <Link href="/signup">
              <Button size="lg" className="h-11 px-8 text-[14px]">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <span className="font-semibold text-[15px] text-white tracking-tight">Scout</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-[14px] text-[#888] hover:text-white transition-colors">
              Features
            </Link>
            <Link href="#demo" className="text-[14px] text-[#888] hover:text-white transition-colors">
              Demo
            </Link>
            <a href="https://github.com/LiamBush5/scout-v2" target="_blank" rel="noopener noreferrer" className="text-[14px] text-[#888] hover:text-white transition-colors">
              GitHub
            </a>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-[14px] text-[#888] hover:text-white transition-colors">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-[14px] text-white px-4 py-1.5 rounded-md border border-[#333] hover:border-[#555] hover:bg-[#111] transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
