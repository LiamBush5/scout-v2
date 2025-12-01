/**
 * GitHub Tools for LangGraph Agent
 *
 * Tools for fetching deployment and commit information from GitHub.
 */

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { Octokit } from '@octokit/rest'
import { createAppAuth } from '@octokit/auth-app'
import type { GitHubCredentials, DeploymentInfo } from '../types'

/**
 * Create GitHub tools with the provided credentials
 */
export function createGitHubTools(credentials: GitHubCredentials) {
    const octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
            appId: credentials.appId,
            privateKey: credentials.privateKey,
            installationId: credentials.installationId,
        },
    })

    // =========================================================================
    // Get Recent Deployments Tool
    // =========================================================================
    const getRecentDeployments = tool(
        async ({ owner, repo, hoursBack, environment }) => {
            try {
                const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()

                const { data: deployments } = await octokit.repos.listDeployments({
                    owner,
                    repo,
                    environment,
                    per_page: 20,
                })

                const recent: DeploymentInfo[] = deployments
                    .filter((d) => new Date(d.created_at) > new Date(since))
                    .slice(0, 10)
                    .map((d) => {
                        const minutesAgo = Math.round(
                            (Date.now() - new Date(d.created_at).getTime()) / 60000
                        )
                        const isPrimeSuspect = minutesAgo >= 5 && minutesAgo <= 60
                        return {
                            sha: d.sha.slice(0, 7),
                            fullSha: d.sha,
                            ref: d.ref,
                            environment: d.environment,
                            creator: d.creator?.login,
                            createdAt: d.created_at,
                            minutesAgo,
                            repo: `${owner}/${repo}`,
                            isPrimeSuspect,
                        }
                    })

                let summary: string
                if (recent.length > 0) {
                    const latest = recent[0]
                    if (latest.isPrimeSuspect) {
                        summary = `🚨 DEPLOYMENT ${latest.sha} deployed ${latest.minutesAgo} min ago - PRIME SUSPECT`
                    } else if (latest.minutesAgo < 60) {
                        summary = `⚠️ Recent deployment ${latest.sha} (${latest.minutesAgo} min ago) - possible cause`
                    } else {
                        summary = `Found ${recent.length} deployments. Most recent: ${latest.minutesAgo} min ago.`
                    }
                } else {
                    summary = `No deployments in the last ${hoursBack} hours.`
                }

                return JSON.stringify(
                    {
                        success: true,
                        repo: `${owner}/${repo}`,
                        summary,
                        deployments: recent,
                    },
                    null,
                    2
                )
            } catch (error) {
                return JSON.stringify({ success: false, error: String(error) })
            }
        },
        {
            name: 'get_github_deployments',
            description: `Get recent deployments from a GitHub repository.
HIGHEST-VALUE tool - most incidents are caused by recent code changes.
A deployment within 5-60 minutes of the incident is the PRIME SUSPECT.`,
            schema: z.object({
                owner: z.string().describe('Repository owner'),
                repo: z.string().describe('Repository name'),
                hoursBack: z.number().default(6),
                environment: z.string().optional().describe('Filter by environment'),
            }),
        }
    )

    // =========================================================================
    // Get Deployment Commits Tool
    // =========================================================================
    const getDeploymentCommits = tool(
        async ({ owner, repo, sha, compareTo }) => {
            try {
                const repository = `${owner}/${repo}`

                if (compareTo) {
                    const { data: comparison } = await octokit.repos.compareCommits({
                        owner,
                        repo,
                        base: compareTo,
                        head: sha,
                    })

                    const commits = comparison.commits.slice(0, 20).map((c) => ({
                        sha: c.sha.slice(0, 7),
                        message: c.commit.message.split('\n')[0].slice(0, 80),
                        author: c.commit.author?.name,
                    }))

                    const files =
                        comparison.files?.slice(0, 20).map((f) => ({
                            filename: f.filename,
                            status: f.status,
                            changes: f.changes,
                        })) || []

                    const highRiskFiles = files
                        .filter((f) => isHighRisk(f.filename))
                        .map((f) => f.filename)
                        .slice(0, 5)

                    return JSON.stringify(
                        {
                            success: true,
                            repository,
                            commits,
                            filesChanged: comparison.files?.length || 0,
                            highRiskFiles,
                            sampleFiles: files.slice(0, 10),
                        },
                        null,
                        2
                    )
                } else {
                    const { data: commit } = await octokit.repos.getCommit({
                        owner,
                        repo,
                        ref: sha,
                    })

                    const files =
                        commit.files?.slice(0, 20).map((f) => ({
                            filename: f.filename,
                            status: f.status,
                            changes: f.changes,
                        })) || []

                    const highRiskFiles = files
                        .filter((f) => isHighRisk(f.filename))
                        .map((f) => f.filename)
                        .slice(0, 5)

                    return JSON.stringify(
                        {
                            success: true,
                            repository,
                            sha: sha.slice(0, 7),
                            message: commit.commit.message.split('\n')[0],
                            author: commit.commit.author?.name,
                            filesChanged: commit.files?.length || 0,
                            highRiskFiles,
                            sampleFiles: files.slice(0, 10),
                        },
                        null,
                        2
                    )
                }
            } catch (error) {
                return JSON.stringify({ success: false, error: String(error) })
            }
        },
        {
            name: 'get_deployment_commits',
            description: 'Get commits included in a deployment to see what code changed',
            schema: z.object({
                owner: z.string(),
                repo: z.string(),
                sha: z.string().describe('Deployment SHA'),
                compareTo: z.string().optional().describe('SHA to compare against'),
            }),
        }
    )

    // =========================================================================
    // Get Recent Commits Tool
    // =========================================================================
    const getRecentCommits = tool(
        async ({ owner, repo, hoursBack, branch }) => {
            try {
                const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()

                const { data: commits } = await octokit.repos.listCommits({
                    owner,
                    repo,
                    sha: branch,
                    since,
                    per_page: 20,
                })

                const recent = commits.map((c) => ({
                    sha: c.sha.slice(0, 7),
                    message: c.commit.message.split('\n')[0].slice(0, 80),
                    author: c.commit.author?.name,
                    date: c.commit.author?.date,
                }))

                return JSON.stringify(
                    {
                        success: true,
                        repo: `${owner}/${repo}`,
                        branch,
                        commits: recent,
                    },
                    null,
                    2
                )
            } catch (error) {
                return JSON.stringify({ success: false, error: String(error) })
            }
        },
        {
            name: 'get_github_commits',
            description: 'Get recent commits from a GitHub repository',
            schema: z.object({
                owner: z.string(),
                repo: z.string(),
                hoursBack: z.number().default(24),
                branch: z.string().default('main'),
            }),
        }
    )

    return [getRecentDeployments, getDeploymentCommits, getRecentCommits]
}

/**
 * Check if a file is considered high-risk for causing issues
 */
function isHighRisk(filename: string): boolean {
    const patterns = [
        'database',
        'migration',
        '.sql',
        'schema',
        'config',
        'settings',
        'env',
        'auth',
        'security',
        'payment',
        'api/',
        'routes',
        'controller',
    ]
    return patterns.some((p) => filename.toLowerCase().includes(p))
}

