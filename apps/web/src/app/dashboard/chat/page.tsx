'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Send, Bot, User, Loader2 } from 'lucide-react'

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
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        }

        setMessages((prev) => [...prev, userMessage])
        setInput('')
        setIsLoading(true)

        try {
            const response = await fetch('/api/agent/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage.content,
                    threadId,
                }),
            })

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
                const errorMessage: Message = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: `Error: ${data.error || 'Something went wrong'}`,
                    timestamp: new Date(),
                }
                setMessages((prev) => [...prev, errorMessage])
            }
        } catch (error) {
            const errorMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: 'Failed to connect to the agent. Make sure it is running.',
                timestamp: new Date(),
            }
            setMessages((prev) => [...prev, errorMessage])
        } finally {
            setIsLoading(false)
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
                    {messages.length === 0 && (
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
                                <p className="whitespace-pre-wrap">{message.content}</p>
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

                    {isLoading && (
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

