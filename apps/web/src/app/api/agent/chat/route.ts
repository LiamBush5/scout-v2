import { NextRequest } from 'next/server'
import { Client } from '@langchain/langgraph-sdk'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'

const chatRequestSchema = z.object({
    message: z.string().min(1),
    threadId: z.string().nullable().optional(),
})

export const maxDuration = 60

// Types for credentials
interface DatadogCredentials {
    apiKey: string
    appKey: string
    site: string
}

interface GitHubCredentials {
    appId: string
    privateKey: string
    installationId: number
}

interface SlackCredentials {
    botToken: string
    defaultChannelId: string
}

interface Credentials {
    datadog?: DatadogCredentials
    github?: GitHubCredentials
    slack?: SlackCredentials
}

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}

/**
 * Load encrypted credentials from Supabase Vault
 */
async function loadCredentials(
    orgId: string,
    supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
): Promise<Credentials> {
    const credentials: Credentials = {}

    // Load all credentials in parallel
    const [datadogCreds, githubCreds, slackCreds] = await Promise.allSettled([
        // Datadog credentials
        Promise.all([
            supabaseAdmin.rpc('get_integration_secret', {
                p_org_id: orgId,
                p_provider: 'datadog',
                p_secret_type: 'api_key',
            }),
            supabaseAdmin.rpc('get_integration_secret', {
                p_org_id: orgId,
                p_provider: 'datadog',
                p_secret_type: 'app_key',
            }),
            supabaseAdmin.rpc('get_integration_secret', {
                p_org_id: orgId,
                p_provider: 'datadog',
                p_secret_type: 'site',
            }),
        ]),
        // GitHub credentials
        Promise.all([
            supabaseAdmin.rpc('get_integration_secret', {
                p_org_id: orgId,
                p_provider: 'github',
                p_secret_type: 'installation_id',
            }),
        ]),
        // Slack credentials
        Promise.all([
            supabaseAdmin.rpc('get_integration_secret', {
                p_org_id: orgId,
                p_provider: 'slack',
                p_secret_type: 'bot_token',
            }),
            supabaseAdmin.rpc('get_integration_secret', {
                p_org_id: orgId,
                p_provider: 'slack',
                p_secret_type: 'channel_id',
            }),
        ]),
    ])

    // Process Datadog credentials
    if (datadogCreds.status === 'fulfilled') {
        const [apiKeyRes, appKeyRes, siteRes] = datadogCreds.value
        const apiKey = apiKeyRes?.data as string | null
        const appKey = appKeyRes?.data as string | null
        const site = siteRes?.data as string | null
        if (apiKey && appKey) {
            credentials.datadog = {
                apiKey,
                appKey,
                site: site || 'datadoghq.com',
            }
        }
    }

    // Process GitHub credentials
    if (githubCreds.status === 'fulfilled') {
        const [installationIdRes] = githubCreds.value
        const installationId = installationIdRes?.data as string | null
        const appId = process.env.GITHUB_APP_ID
        const privateKey = process.env.GITHUB_PRIVATE_KEY

        if (installationId && appId && privateKey) {
            credentials.github = {
                appId,
                privateKey: privateKey.replace(/\\n/g, '\n'),
                installationId: parseInt(installationId, 10),
            }
        }
    }

    // Process Slack credentials
    if (slackCreds.status === 'fulfilled') {
        const [botTokenRes, channelIdRes] = slackCreds.value
        const botToken = botTokenRes?.data as string | null
        const channelId = channelIdRes?.data as string | null
        if (botToken && channelId) {
            credentials.slack = {
                botToken,
                defaultChannelId: channelId,
            }
        }
    }

    return credentials
}

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

        // Get the current user's org
        const supabase = await createServerClient()
        const { data: { user } } = await supabase.auth.getUser()

        let orgId: string | null = null
        let credentials: Credentials = {}

        if (user) {
            // Get user's current org
            const { data: profile } = await supabase
                .from('profiles')
                .select('current_org_id')
                .eq('id', user.id)
                .single()

            if (profile?.current_org_id) {
                orgId = profile.current_org_id

                // Load credentials for this org
                const supabaseAdmin = getSupabaseAdmin()
                credentials = await loadCredentials(orgId, supabaseAdmin)
            }
        }

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
                                org_id: orgId || 'chat',
                                alert_context: {
                                    alert_name: 'Chat Query',
                                    service: 'chat',
                                    severity: 'info',
                                    message: message,
                                },
                                // Pass credentials to the agent
                                datadog_creds: credentials.datadog ? {
                                    api_key: credentials.datadog.apiKey,
                                    app_key: credentials.datadog.appKey,
                                    site: credentials.datadog.site,
                                } : null,
                                github_creds: credentials.github ? {
                                    app_id: credentials.github.appId,
                                    private_key: credentials.github.privateKey,
                                    installation_id: credentials.github.installationId,
                                } : null,
                                slack_creds: credentials.slack ? {
                                    bot_token: credentials.slack.botToken,
                                    channel_id: credentials.slack.defaultChannelId,
                                } : null,
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
                        // Process message events
                        if (chunk.event === 'messages') {
                            const [messageChunk, metadata] = chunk.data as [
                                {
                                    content?: string
                                    role?: string
                                    type?: string
                                    name?: string
                                    tool_calls?: Array<{ name: string; args: Record<string, unknown>; id: string }>
                                },
                                { langgraph_node?: string }
                            ]

                            // Send tool calls to the client
                            if (messageChunk?.tool_calls && messageChunk.tool_calls.length > 0) {
                                for (const toolCall of messageChunk.tool_calls) {
                                    const toolData = JSON.stringify({
                                        type: 'tool_call',
                                        toolName: toolCall.name,
                                        toolArgs: toolCall.args,
                                        toolId: toolCall.id,
                                    })
                                    controller.enqueue(encoder.encode(`data: ${toolData}\n\n`))
                                }
                            }

                            // Send tool results to the client
                            if (messageChunk?.type === 'tool' || messageChunk?.name) {
                                const toolResultData = JSON.stringify({
                                    type: 'tool_result',
                                    toolName: messageChunk.name,
                                    content: messageChunk.content,
                                })
                                controller.enqueue(encoder.encode(`data: ${toolResultData}\n\n`))
                            }

                            // Only stream AI assistant content, not tool calls or tool outputs
                            // Filter out:
                            // - Tool messages (type === 'tool' or role === 'tool')
                            // - Tool call results (content that looks like JSON objects)
                            // - Messages from tool nodes
                            if (
                                messageChunk?.content &&
                                typeof messageChunk.content === 'string' &&
                                messageChunk.type !== 'tool' &&
                                messageChunk.role !== 'tool' &&
                                !messageChunk.name && // Tool messages have a 'name' field
                                metadata?.langgraph_node !== 'tools' &&
                                // Skip content that looks like raw JSON tool output
                                !messageChunk.content.trim().startsWith('{ "') &&
                                !messageChunk.content.trim().startsWith('{"')
                            ) {
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
