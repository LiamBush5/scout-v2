'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Send, Bot, User, Loader2, ChevronDown, ChevronRight, Wrench, CheckCircle2, Clock } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ToolCall {
    id: string
    name: string
    args: Record<string, unknown>
    result?: string
    status: 'running' | 'completed'
    startedAt: Date
    completedAt?: Date
}

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    toolCalls?: ToolCall[]
}

// Tool call display component
function ToolCallsSection({ toolCalls, isStreaming }: { toolCalls: ToolCall[]; isStreaming: boolean }) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())

    const completedCount = toolCalls.filter(t => t.status === 'completed').length
    const runningCount = toolCalls.filter(t => t.status === 'running').length

    const toggleTool = (id: string) => {
        setExpandedTools(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const formatToolName = (name: string) => {
        return name
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
    }

    const formatJson = (obj: unknown): string => {
        try {
            if (typeof obj === 'string') {
                // Try to parse if it's a JSON string
                try {
                    const parsed = JSON.parse(obj)
                    return JSON.stringify(parsed, null, 2)
                } catch {
                    return obj
                }
            }
            return JSON.stringify(obj, null, 2)
        } catch {
            return String(obj)
        }
    }

    const truncateResult = (result: string, maxLength: number = 500): { text: string; truncated: boolean } => {
        if (result.length <= maxLength) return { text: result, truncated: false }
        return { text: result.slice(0, maxLength), truncated: true }
    }

    if (toolCalls.length === 0) return null

    return (
        <div className="mb-3">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            >
                {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                ) : (
                    <ChevronRight className="h-3 w-3" />
                )}
                <Wrench className="h-3 w-3" />
                <span className="font-medium">
                    {runningCount > 0 ? (
                        <>
                            <span className="text-yellow-500">{runningCount} running</span>
                            {completedCount > 0 && <span className="text-muted-foreground"> · {completedCount} completed</span>}
                        </>
                    ) : (
                        <span className="text-green-500">{completedCount} tool{completedCount !== 1 ? 's' : ''} completed</span>
                    )}
                </span>
                {runningCount > 0 && <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />}
            </button>

            {isExpanded && (
                <div className="mt-2 space-y-2 pl-5 border-l-2 border-border">
                    {toolCalls.map((tool) => (
                        <div
                            key={tool.id}
                            className="bg-background/50 rounded-md border border-border overflow-hidden"
                        >
                            <button
                                onClick={() => toggleTool(tool.id)}
                                className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                            >
                                {expandedTools.has(tool.id) ? (
                                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                ) : (
                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                )}
                                {tool.status === 'running' ? (
                                    <Clock className="h-3 w-3 text-yellow-500" />
                                ) : (
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                )}
                                <span className="text-xs font-medium flex-1">
                                    {formatToolName(tool.name)}
                                </span>
                                {tool.status === 'running' && (
                                    <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
                                )}
                                {tool.completedAt && (
                                    <span className="text-[10px] text-muted-foreground">
                                        {((tool.completedAt.getTime() - tool.startedAt.getTime()) / 1000).toFixed(1)}s
                                    </span>
                                )}
                            </button>

                            {expandedTools.has(tool.id) && (
                                <div className="px-3 pb-3 space-y-2">
                                    {/* Arguments */}
                                    {Object.keys(tool.args).length > 0 && (
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Arguments</p>
                                            <pre className="text-[11px] bg-muted/50 p-2 rounded overflow-x-auto max-h-32">
                                                {formatJson(tool.args)}
                                            </pre>
                                        </div>
                                    )}

                                    {/* Result */}
                                    {tool.result && (
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Result</p>
                                            <ToolResultDisplay result={tool.result} />
                                        </div>
                                    )}

                                    {tool.status === 'running' && (
                                        <div className="flex items-center gap-2 text-xs text-yellow-500">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            <span>Running...</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// Separate component for tool result display with its own expand state
function ToolResultDisplay({ result }: { result: string }) {
    const [isFullyExpanded, setIsFullyExpanded] = useState(false)

    const formatJson = (str: string): string => {
        try {
            const parsed = JSON.parse(str)
            return JSON.stringify(parsed, null, 2)
        } catch {
            return str
        }
    }

    const formatted = formatJson(result)
    const maxLength = 500
    const isTruncatable = formatted.length > maxLength
    const displayText = isFullyExpanded ? formatted : formatted.slice(0, maxLength)

    return (
        <div>
            <pre className="text-[11px] bg-muted/50 p-2 rounded overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-words">
                {displayText}
                {isTruncatable && !isFullyExpanded && '...'}
            </pre>
            {isTruncatable && (
                <button
                    onClick={() => setIsFullyExpanded(!isFullyExpanded)}
                    className="text-[10px] text-primary hover:underline mt-1"
                >
                    {isFullyExpanded ? 'Show less' : `Show more (${(formatted.length / 1024).toFixed(1)}KB)`}
                </button>
            )}
        </div>
    )
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [threadId, setThreadId] = useState<string | null>(null)
    const [streamingContent, setStreamingContent] = useState('')
    const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCall[]>([])
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messages, streamingContent, streamingToolCalls, scrollToBottom])

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return

        // Cancel any existing request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        }

        setMessages((prev) => [...prev, userMessage])
        setInput('')
        setIsLoading(true)
        setStreamingContent('')
        setStreamingToolCalls([])

        const abortController = new AbortController()
        abortControllerRef.current = abortController

        try {
            const response = await fetch('/api/agent/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage.content,
                    threadId,
                }),
                signal: abortController.signal,
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            // Check if it's a streaming response (SSE)
            const contentType = response.headers.get('content-type')

            if (contentType?.includes('text/event-stream')) {
                // Handle SSE streaming
                const reader = response.body?.getReader()
                const decoder = new TextDecoder()
                let accumulatedContent = ''
                let accumulatedToolCalls: ToolCall[] = []

                if (!reader) {
                    throw new Error('No response body')
                }

                while (true) {
                    const { done, value } = await reader.read()

                    if (done) break

                    const text = decoder.decode(value, { stream: true })
                    const lines = text.split('\n')

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6))

                                if (data.type === 'token') {
                                    accumulatedContent += data.content
                                    setStreamingContent(accumulatedContent)
                                } else if (data.type === 'tool_call') {
                                    // Add new tool call
                                    const newToolCall: ToolCall = {
                                        id: data.toolId,
                                        name: data.toolName,
                                        args: data.toolArgs || {},
                                        status: 'running',
                                        startedAt: new Date(),
                                    }
                                    accumulatedToolCalls = [...accumulatedToolCalls, newToolCall]
                                    setStreamingToolCalls(accumulatedToolCalls)
                                } else if (data.type === 'tool_result') {
                                    // Update tool call with result
                                    accumulatedToolCalls = accumulatedToolCalls.map(tc => {
                                        if (tc.name === data.toolName && tc.status === 'running') {
                                            return {
                                                ...tc,
                                                result: data.content,
                                                status: 'completed' as const,
                                                completedAt: new Date(),
                                            }
                                        }
                                        return tc
                                    })
                                    setStreamingToolCalls(accumulatedToolCalls)
                                } else if (data.type === 'done') {
                                    // Stream complete, add the full message
                                    if (accumulatedContent || accumulatedToolCalls.length > 0) {
                                        const assistantMessage: Message = {
                                            id: crypto.randomUUID(),
                                            role: 'assistant',
                                            content: accumulatedContent,
                                            timestamp: new Date(),
                                            toolCalls: accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined,
                                        }
                                        setMessages((prev) => [...prev, assistantMessage])
                                    }
                                    setThreadId(data.threadId)
                                    setStreamingContent('')
                                    setStreamingToolCalls([])
                                } else if (data.type === 'error') {
                                    throw new Error(data.error)
                                }
                            } catch (parseError) {
                                // Ignore parse errors for incomplete chunks
                                if (line.slice(6).trim()) {
                                    console.warn('Failed to parse SSE data:', line)
                                }
                            }
                        }
                    }
                }

                // Fallback: If we accumulated content but didn't get a done event,
                // add the message. Use the callback form to check current state
                // and avoid duplicates from the closure stale reference.
                if (accumulatedContent || accumulatedToolCalls.length > 0) {
                    setMessages((prev) => {
                        // Check if message was already added by the 'done' event
                        if (prev.some(m => m.content === accumulatedContent && m.role === 'assistant')) {
                            return prev
                        }
                        const assistantMessage: Message = {
                            id: crypto.randomUUID(),
                            role: 'assistant',
                            content: accumulatedContent,
                            timestamp: new Date(),
                            toolCalls: accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined,
                        }
                        return [...prev, assistantMessage]
                    })
                    setStreamingContent('')
                    setStreamingToolCalls([])
                }
            } else {
                // Handle non-streaming JSON response (fallback)
                const data = await response.json()

                if (data.success) {
                    setThreadId(data.threadId)

                    const assistantMessage: Message = {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        content: data.response,
                        timestamp: new Date(),
                    }
                    setMessages((prev) => [...prev, assistantMessage])
                } else {
                    throw new Error(data.error || 'Something went wrong')
                }
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                // Request was cancelled, don't show error
                return
            }

            const errorMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: error instanceof Error
                    ? `Error: ${error.message}`
                    : 'Failed to connect to the agent. Make sure it is running.',
                timestamp: new Date(),
            }
            setMessages((prev) => [...prev, errorMessage])
            setStreamingContent('')
            setStreamingToolCalls([])
        } finally {
            setIsLoading(false)
            abortControllerRef.current = null
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Chat with SRE Agent</h1>
                <p className="text-muted-foreground">
                    Ask questions about your infrastructure, incidents, or get help with investigations.
                </p>
            </div>

            <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="border-b py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        SRE Investigation Agent
                    </CardTitle>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && !streamingContent && streamingToolCalls.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                            <Bot className="h-12 w-12 mb-4 opacity-50" />
                            <p className="text-lg font-medium">Start a conversation</p>
                            <p className="text-sm max-w-md mt-2">
                                Ask me about incidents, deployments, metrics, or anything related to your infrastructure.
                            </p>
                            <div className="mt-6 space-y-2 text-sm">
                                <p className="font-medium">Try asking:</p>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {[
                                        'What should I check during an incident?',
                                        'How do I investigate high latency?',
                                        'What are common causes of errors?',
                                    ].map((suggestion) => (
                                        <button
                                            key={suggestion}
                                            onClick={() => setInput(suggestion)}
                                            className="px-3 py-1.5 bg-muted rounded-full hover:bg-muted/80 transition-colors"
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex gap-3 ${
                                message.role === 'user' ? 'justify-end' : 'justify-start'
                            }`}
                        >
                            {message.role === 'assistant' && (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Bot className="h-4 w-4 text-primary" />
                                </div>
                            )}

                            <div
                                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                                    message.role === 'user'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted'
                                }`}
                            >
                                {message.role === 'assistant' && message.toolCalls && (
                                    <ToolCallsSection toolCalls={message.toolCalls} isStreaming={false} />
                                )}
                                {message.role === 'assistant' ? (
                                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <p className="whitespace-pre-wrap">{message.content}</p>
                                )}
                                <p className="text-xs opacity-60 mt-1">
                                    {message.timestamp.toLocaleTimeString()}
                                </p>
                            </div>

                            {message.role === 'user' && (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                                    <User className="h-4 w-4 text-primary-foreground" />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Streaming message */}
                    {(streamingContent || streamingToolCalls.length > 0) && (
                        <div className="flex gap-3 justify-start">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Bot className="h-4 w-4 text-primary" />
                            </div>
                            <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
                                {streamingToolCalls.length > 0 && (
                                    <ToolCallsSection toolCalls={streamingToolCalls} isStreaming={true} />
                                )}
                                {streamingContent && (
                                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                                    </div>
                                )}
                                {!streamingContent && streamingToolCalls.length > 0 && streamingToolCalls.some(t => t.status === 'running') && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        <span>Processing...</span>
                                    </div>
                                )}
                                {streamingContent && (
                                    <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-0.5" />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Loading indicator when waiting for stream to start */}
                    {isLoading && !streamingContent && streamingToolCalls.length === 0 && (
                        <div className="flex gap-3 justify-start">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Bot className="h-4 w-4 text-primary" />
                            </div>
                            <div className="bg-muted rounded-lg px-4 py-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </CardContent>

                <div className="border-t p-4">
                    <div className="flex gap-2">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask a question..."
                            disabled={isLoading}
                            className="flex-1"
                        />
                        <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    )
}
