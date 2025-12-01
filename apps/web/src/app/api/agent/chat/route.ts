import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const chatRequestSchema = z.object({
    message: z.string().min(1),
    threadId: z.string().nullable().optional(),
})

export const maxDuration = 60

/**
 * Chat with the SRE agent
 *
 * This endpoint allows you to ask questions to the agent directly.
 */
export async function POST(request: NextRequest) {
    const requestId = crypto.randomUUID()

    try {
        const body = await request.json()
        const { message, threadId } = chatRequestSchema.parse(body)

        const agentUrl = process.env.AGENT_API_URL || 'http://127.0.0.1:2024'

        const currentThreadId = threadId || requestId

        // Call the agent using the synchronous /runs/wait endpoint
        const agentResponse = await fetch(`${agentUrl}/runs/wait`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                assistant_id: 'investigation',
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
                config: {
                    configurable: {
                        thread_id: currentThreadId,
                    },
                },
            }),
        })

        if (!agentResponse.ok) {
            const errorText = await agentResponse.text()
            console.error('Agent error:', errorText)
            throw new Error(`Agent API error: ${agentResponse.status} - ${errorText}`)
        }

        const result = await agentResponse.json()
        console.log('Agent result:', JSON.stringify(result, null, 2))

        // Extract the assistant's response from the final state
        let response = 'I was unable to process your request.'

        // The result contains the final state values
        const messages = result.messages || result.values?.messages || []

        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i]
            // Check for AI message
            if (msg.type === 'ai' || msg.role === 'assistant' || (msg.content && !msg.tool_calls?.length)) {
                const content = typeof msg.content === 'string' ? msg.content : msg.content?.[0]?.text
                if (content && content.length > 0) {
                    response = content
                    break
                }
            }
        }

        // Fallback to checking other fields
        if (response === 'I was unable to process your request.') {
            if (result.summary) response = result.summary
            else if (result.output) response = typeof result.output === 'string' ? result.output : JSON.stringify(result.output)
        }

        return NextResponse.json({
            success: true,
            response,
            threadId: currentThreadId,
            requestId,
        })
    } catch (error) {
        console.error('Chat error:', error)

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Chat failed',
                requestId,
            },
            { status: 500 }
        )
    }
}

