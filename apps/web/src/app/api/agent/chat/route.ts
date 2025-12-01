import { NextRequest } from 'next/server'
import { Client } from '@langchain/langgraph-sdk'
import { z } from 'zod'

const chatRequestSchema = z.object({
    message: z.string().min(1),
    threadId: z.string().nullable().optional(),
})

export const maxDuration = 60

/**
 * Chat with the SRE agent using streaming
 *
 * This endpoint allows you to ask questions to the agent directly with streaming responses.
 */
export async function POST(request: NextRequest) {
    const requestId = crypto.randomUUID()

    try {
        const body = await request.json()
        const { message, threadId } = chatRequestSchema.parse(body)

        const agentUrl = process.env.AGENT_API_URL || 'http://127.0.0.1:2024'
        const client = new Client({ apiUrl: agentUrl })

        const currentThreadId = threadId || requestId

        // Create or get thread
        let thread
        if (threadId) {
            try {
                thread = await client.threads.get(threadId)
            } catch {
                // Thread doesn't exist, create new one
                thread = await client.threads.create()
            }
        } else {
            thread = await client.threads.create()
        }

        const assistantId = 'investigation'

        // Create a readable stream for the response
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Stream the response using messages-tuple mode for token-by-token streaming
                    const streamResponse = client.runs.stream(
                        thread.thread_id,
                        assistantId,
                        {
                            input: {
                                messages: [{ role: 'human', content: message }],
                                investigation_id: currentThreadId,
                                org_id: 'chat',
                                alert_context: {
                                    alert_name: 'Chat Query',
                                    service: 'chat',
                                    severity: 'info',
                                    message: message,
                                },
                                phase: 'triage',
                                iteration: 0,
                                max_iterations: 5,
                                recent_deployments: [],
                                affected_services: [],
                                started_at: new Date().toISOString(),
                            },
                            streamMode: 'messages-tuple',
                        }
                    )

                    for await (const chunk of streamResponse) {
                        // Only process message events
                        if (chunk.event === 'messages') {
                            const [messageChunk] = chunk.data as [{ content?: string; role?: string }, unknown]

                            // Only stream assistant content (not tool calls)
                            if (messageChunk?.content && typeof messageChunk.content === 'string') {
                                const data = JSON.stringify({
                                    type: 'token',
                                    content: messageChunk.content,
                                })
                                controller.enqueue(encoder.encode(`data: ${data}\n\n`))
                            }
                        }
                    }

                    // Send completion message
                    const doneData = JSON.stringify({
                        type: 'done',
                        threadId: thread.thread_id,
                        requestId,
                    })
                    controller.enqueue(encoder.encode(`data: ${doneData}\n\n`))
                    controller.close()
                } catch (error) {
                    console.error('Streaming error:', error)
                    const errorData = JSON.stringify({
                        type: 'error',
                        error: error instanceof Error ? error.message : 'Streaming failed',
                    })
                    controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
                    controller.close()
                }
            },
        })

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        })
    } catch (error) {
        console.error('Chat error:', error)

        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Chat failed',
                requestId,
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        )
    }
}
