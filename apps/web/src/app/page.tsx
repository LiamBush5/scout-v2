'use client'

import Link from 'next/link'
import { 
  ArrowRight, 
  GitBranch, 
  MessageSquare, 
  Activity,
  Terminal,
  Zap,
  BarChart3,
  Shield
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-foreground">
            <Activity className="h-4 w-4 text-primary" />
            <span className="font-medium">scout</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link 
              href="/login"
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Log in
            </Link>
            <Link 
              href="/signup"
              className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted/50 transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm text-muted-foreground font-mono mb-4">
            Automated incident investigation
          </p>
          <h1 className="text-3xl sm:text-4xl font-medium tracking-tight mb-4 leading-tight">
            Debug production incidents<br />
            while you sleep
          </h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Scout watches your Datadog alerts, checks recent deployments, 
            and posts findings to Slack. No more 3am pages for things 
            a script could figure out.
          </p>
          <div className="flex items-center gap-3">
            <Link 
              href="/signup"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-foreground text-background rounded-md hover:bg-foreground/90 transition-colors"
            >
              Get started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link 
              href="#how"
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      {/* Terminal Demo */}
      <section className="py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/30">
              <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/20" />
              <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/20" />
              <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/20" />
              <span className="text-[11px] text-muted-foreground ml-2 font-mono">investigation-12847</span>
            </div>
            
            <div className="p-4 font-mono text-[13px] space-y-3 bg-card/50">
              <div className="flex items-start gap-2.5">
                <Terminal className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <span>
                  <span className="text-muted-foreground">alert:</span>{' '}
                  <span className="text-foreground">api-gateway</span>{' '}
                  <span className="text-muted-foreground">error rate 15.2%</span>
                </span>
              </div>
              
              <div className="flex items-start gap-2.5">
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <span>
                  <span className="text-muted-foreground">deploy:</span>{' '}
                  <span className="text-foreground">a3f8c21</span>{' '}
                  <span className="text-primary">23m ago</span>{' '}
                  <span className="text-muted-foreground">@sarah</span>
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <Zap className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <span>
                  <span className="text-muted-foreground">changed:</span>{' '}
                  <span className="text-foreground">database/connection.py</span>
                </span>
              </div>
              
              <div className="flex items-start gap-2.5">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <span>
                  <span className="text-muted-foreground">metrics:</span>{' '}
                  <span className="text-foreground">connection pool exhausted 14:32</span>
                </span>
              </div>
              
              <div className="border-t border-border pt-3 mt-3">
                <div className="flex items-start gap-2.5">
                  <Shield className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <span className="text-foreground">pool size reduced 100→10 in a3f8c21</span>
                    <div className="text-muted-foreground mt-1">
                      → revert or increase pool_size
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-2.5 text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>posted to #incidents</span>
              </div>
              
              <div className="text-muted-foreground/60 text-[11px] pt-2">
                completed in 2m 34s
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-16 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-lg font-medium mb-8">How it works</h2>
          
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="text-muted-foreground font-mono text-sm w-6 shrink-0">01</div>
              <div>
                <div className="font-medium mb-1">Datadog sends a webhook</div>
                <div className="text-sm text-muted-foreground">
                  When a monitor fires, Scout receives the alert and starts investigating.
                </div>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="text-muted-foreground font-mono text-sm w-6 shrink-0">02</div>
              <div>
                <div className="font-medium mb-1">Scout checks recent deployments</div>
                <div className="text-sm text-muted-foreground">
                  Pulls deployment history from GitHub and flags anything suspicious.
                </div>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="text-muted-foreground font-mono text-sm w-6 shrink-0">03</div>
              <div>
                <div className="font-medium mb-1">Queries metrics and logs</div>
                <div className="text-sm text-muted-foreground">
                  Uses your Datadog API to find anomalies and correlate with the alert.
                </div>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="text-muted-foreground font-mono text-sm w-6 shrink-0">04</div>
              <div>
                <div className="font-medium mb-1">Posts findings to Slack</div>
                <div className="text-sm text-muted-foreground">
                  Shares the likely root cause with evidence and suggested next steps.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6 border-t border-border/40">
        <div className="max-w-2xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-8">
            <div>
              <div className="text-sm font-medium mb-2">Fast</div>
              <div className="text-sm text-muted-foreground">
                Investigations complete in under 3 minutes. Faster than you can 
                open your laptop.
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Accurate</div>
              <div className="text-sm text-muted-foreground">
                89% of root causes are correct. Includes confidence scores 
                so you know when to trust it.
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Private</div>
              <div className="text-sm text-muted-foreground">
                Your credentials stay in Supabase Vault. We never store 
                your logs or metrics.
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Simple</div>
              <div className="text-sm text-muted-foreground">
                Connect Datadog, GitHub, and Slack. Takes 5 minutes to set up.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 border-t border-border/40">
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="font-medium mb-1">Ready to stop firefighting?</div>
              <div className="text-sm text-muted-foreground">Free for small teams. No credit card required.</div>
            </div>
            <Link 
              href="/signup"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm bg-foreground text-background rounded-md hover:bg-foreground/90 transition-colors shrink-0"
            >
              Get started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border/40">
        <div className="max-w-2xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Activity className="h-3.5 w-3.5" />
            <span>scout</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-foreground transition-colors">Log in</Link>
            <a 
              href="https://github.com/LiamBush5/scout-v2" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
