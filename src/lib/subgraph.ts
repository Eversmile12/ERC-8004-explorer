/**
 * Subgraph client for querying ERC-8004 agents from The Graph
 *
 * This module provides functions to fetch agent data from the Agent0 subgraph
 * deployed on Ethereum Sepolia. The subgraph indexes all ERC-8004 agent
 * registrations, their metadata, and feedback/reviews.
 *
 * Subgraph URL: https://thegraph.com/explorer/subgraphs/6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT
 */

// Agent0's public subgraph endpoint for Ethereum Sepolia
const SUBGRAPH_URL =
    "https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT";

/**
 * Agent entity from the subgraph
 */
export interface Agent {
    id: string; // Format: "chainId:tokenId"
    chainId: string;
    agentId: string; // Token ID
    owner: string; // Wallet address
    metadataUri: string;
    createdAt: string; // Unix timestamp
    updatedAt: string;
    totalFeedback: string;
    registrationFile: {
        name: string | null;
        description: string | null;
        image: string | null;
        mcpEndpoint: string | null;
        a2aEndpoint: string | null;
        supportedTrusts: string[] | null;
    } | null;
}

/**
 * Feedback/review entity from the subgraph
 */
export interface Feedback {
    id: string;
    score: string; // 0-100
    tag1: string | null;
    tag2: string | null;
    clientAddress: string; // Reviewer's wallet
    createdAt: string;
    isRevoked: boolean;
    feedbackFile: {
        text: string | null;
        capability: string | null;
        skill: string | null;
    } | null;
}

/**
 * Filter options for fetching agents
 */
export interface AgentFilters {
    search?: string; // Search by agent name
    hasReviews?: boolean; // Only agents with reviews
    hasEndpoint?: boolean; // Only agents with MCP or A2A endpoint
}

/**
 * Fetches a paginated list of agents from the subgraph
 *
 * @param first - Number of agents to fetch (default: 24)
 * @param skip - Number of agents to skip for pagination (default: 0)
 * @param filters - Optional filters (search, hasReviews, hasEndpoint)
 * @returns Array of Agent objects
 */
export async function fetchAgents(first: number = 24, skip: number = 0, filters?: AgentFilters): Promise<Agent[]> {
    // Build where conditions array
    // Note: The Graph doesn't allow mixing 'or' with other filters at the same level,
    // so we use 'and' to properly combine conditions when needed
    const conditions: string[] = [];

    if (filters?.search) {
        conditions.push(`{ registrationFile_: { name_contains_nocase: "${filters.search}" } }`);
    }

    if (filters?.hasReviews) {
        conditions.push(`{ totalFeedback_gt: 0 }`);
    }

    if (filters?.hasEndpoint) {
        // Filter for agents that have either MCP or A2A endpoint
        // Wrap in its own object since 'or' can't be mixed with other conditions
        conditions.push(`{ or: [
            { registrationFile_: { mcpEndpoint_not: null } },
            { registrationFile_: { a2aEndpoint_not: null } }
        ] }`);
    }

    // Use 'and' to combine multiple conditions properly
    let whereClause = "";
    if (conditions.length === 1) {
        // Single condition - unwrap from array
        whereClause = `where: ${conditions[0]}`;
    } else if (conditions.length > 1) {
        whereClause = `where: { and: [${conditions.join(", ")}] }`;
    }

    const query = `
    {
      agents(
        first: ${first}
        skip: ${skip}
        orderBy: createdAt
        orderDirection: desc
        ${whereClause}
      ) {
        id
        chainId
        agentId
        owner
        agentURI
        createdAt
        updatedAt
        totalFeedback
        registrationFile {
          name
          description
          image
          mcpEndpoint
          a2aEndpoint
          supportedTrusts
        }
      }
    }
  `;

    const data = (await querySubgraph(query)) as { agents: (Agent & { agentURI: string })[] };

    // Map agentURI to metadataUri for consistency
    return data.agents.map((agent) => ({
        ...agent,
        metadataUri: agent.agentURI,
    }));
}

/**
 * Fetches a single agent with its feedback/reviews
 *
 * @param agentId - Agent ID in format "chainId:tokenId"
 * @returns Object containing the agent and its feedback array
 */
export async function fetchAgentWithFeedback(agentId: string): Promise<{ agent: Agent | null; feedback: Feedback[] }> {
    const query = `
    {
      agent(id: "${agentId}") {
        id
        chainId
        agentId
        agentURI
        owner
        createdAt
        updatedAt
        totalFeedback
        registrationFile {
          name
          description
          image
          mcpEndpoint
          a2aEndpoint
          supportedTrusts
          ens
          agentWallet
        }
        feedback(
          first: 50
          orderBy: createdAt
          orderDirection: desc
          where: { isRevoked: false }
        ) {
          id
          score
          tag1
          tag2
          clientAddress
          createdAt
          isRevoked
          feedbackFile {
            text
            capability
            skill
          }
        }
      }
    }
  `;

    const data = (await querySubgraph(query)) as {
        agent: (Agent & { agentURI: string; feedback: Feedback[] }) | null;
    };

    const agent = data.agent;

    if (!agent) {
        return { agent: null, feedback: [] };
    }

    return {
        agent: { ...agent, metadataUri: agent.agentURI },
        feedback: agent.feedback || [],
    };
}

/**
 * Fetches global statistics from the subgraph
 *
 * @returns Object with totalAgents and totalFeedback counts
 */
export async function fetchGlobalStats(): Promise<{
    totalAgents: string;
    totalFeedback: string;
}> {
    const query = `
    {
      globalStats(id: "global") {
        totalAgents
        totalFeedback
      }
    }
  `;

    const data = (await querySubgraph(query)) as {
        globalStats: { totalAgents: string; totalFeedback: string };
    };
    return data.globalStats;
}

/**
 * Helper function to execute GraphQL queries against the subgraph
 *
 * @param query - GraphQL query string
 * @returns Parsed JSON response data
 * @throws Error if the request fails or returns GraphQL errors
 */
async function querySubgraph(query: string): Promise<Record<string, unknown>> {
    const response = await fetch(SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
    });

    if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
        throw new Error(`GraphQL error: ${result.errors[0].message}`);
    }

    return result.data;
}
