'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Send, Bot, User, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [threadId, setThreadId] = useState<string | null>(null)
    const [streamingContent, setStreamingContent] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messages, streamingContent, scrollToBottom])

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
                                } else if (data.type === 'done') {
                                    // Stream complete, add the full message
                                    if (accumulatedContent) {
                                        const assistantMessage: Message = {
                                            id: crypto.randomUUID(),
                                            role: 'assistant',
                                            content: accumulatedContent,
                                            timestamp: new Date(),
                                        }
                                        setMessages((prev) => [...prev, assistantMessage])
                                    }
                                    setThreadId(data.threadId)
                                    setStreamingContent('')
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
                if (accumulatedContent) {
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
                        }
                        return [...prev, assistantMessage]
                    })
                    setStreamingContent('')
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
                    {messages.length === 0 && !streamingContent && (
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
                                {message.role === 'assistant' ? (
                                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2">
                                        <ReactMarkdown>{message.content}</ReactMarkdown>
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
                    {streamingContent && (
                        <div className="flex gap-3 justify-start">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Bot className="h-4 w-4 text-primary" />
                            </div>
                            <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
                                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2">
                                    <ReactMarkdown>{streamingContent}</ReactMarkdown>
                                </div>
                                <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-0.5" />
                            </div>
                        </div>
                    )}

                    {/* Loading indicator when waiting for stream to start */}
                    {isLoading && !streamingContent && (
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
