'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  Zap,
  GitBranch,
  MessageSquare,
  Activity,
  Clock,
  Shield,
  BarChart3,
  ChevronRight,
  Terminal
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-lg">Scout AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

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

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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

          <p className="text-sm text-muted-foreground mt-6">
            No credit card required. Free for small teams.
          </p>
        </div>
      </section>

      {/* Live Demo Terminal */}
      <section id="demo" className="py-20 px-6">
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

      {/* Stats */}
      <section className="py-16 px-6 border-y border-border bg-card/30">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: '73%', label: 'Faster MTTR' },
            { value: '2min', label: 'Avg investigation time' },
            { value: '89%', label: 'Root cause accuracy' },
            { value: '24/7', label: 'Always watching' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything you need to resolve incidents faster
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Scout connects to your existing tools and starts investigating automatically when alerts fire.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Activity,
                title: 'Datadog Integration',
                description: 'Automatically queries metrics, logs, and APM data to understand service health and find anomalies.',
              },
              {
                icon: GitBranch,
                title: 'Deployment Correlation',
                description: 'Connects to GitHub to find recent deployments and analyze what code changed before the incident.',
              },
              {
                icon: MessageSquare,
                title: 'Slack Reporting',
                description: 'Posts investigation results with confidence levels, evidence, and recommended actions to your team.',
              },
              {
                icon: Clock,
                title: 'Instant Triage',
                description: 'Starts investigating within seconds of an alert, following the same process your best SREs would.',
              },
              {
                icon: Shield,
                title: 'Root Cause Analysis',
                description: 'Identifies the most likely root cause with supporting evidence and confidence scoring.',
              },
              {
                icon: Zap,
                title: 'Always Learning',
                description: 'Improves over time based on feedback from your team on investigation accuracy.',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-xl border border-border bg-card/50 hover:bg-card/80 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 bg-card/30 border-y border-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Up and running in 5 minutes
            </h2>
            <p className="text-muted-foreground text-lg">
              Connect your tools and let Scout handle the rest.
            </p>
          </div>

          <div className="space-y-8">
            {[
              {
                step: '01',
                title: 'Connect Datadog',
                description: 'Add your API keys and select which monitors should trigger investigations.',
              },
              {
                step: '02',
                title: 'Install GitHub App',
                description: 'One-click install to let Scout analyze deployments and code changes.',
              },
              {
                step: '03',
                title: 'Add to Slack',
                description: 'Choose which channel to receive investigation results and updates.',
              },
              {
                step: '04',
                title: 'Relax',
                description: 'Scout automatically investigates when alerts fire and reports findings to your team.',
              },
            ].map((item, index) => (
              <div key={item.step} className="flex items-start gap-6">
                <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="text-primary font-mono font-bold">{item.step}</span>
                </div>
                <div className="pt-2">
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
                {index < 3 && (
                  <div className="hidden md:block absolute left-[3.25rem] mt-14 w-px h-8 bg-border" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Stop fighting fires manually
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Join teams who are resolving incidents 73% faster with Scout AI.
          </p>
          <Link href="/signup">
            <Button size="lg" className="h-12 px-8 text-base">
              Get started for free
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold">Scout AI</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">Sign up</Link>
            <a href="https://github.com/LiamBush5/scout-v2" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
          </div>
          <div className="text-sm text-muted-foreground">
            Built by Liam Bush
          </div>
        </div>
      </footer>
    </div>
  )
}
