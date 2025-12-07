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

    // Map agentURI to metadataUri and resolve missing metadata
    const agents = await Promise.all(
        data.agents.map(async (agent) => {
            // If registrationFile is null but we have a URI, try to fetch it
            let registrationFile = agent.registrationFile;
            if (!registrationFile && agent.agentURI) {
                registrationFile = await resolveMetadata(agent.agentURI);
            }

            return {
                ...agent,
                metadataUri: agent.agentURI,
                registrationFile,
            };
        })
    );

    return agents;
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

    // If registrationFile is null but we have a URI, try to fetch it
    let registrationFile = agent.registrationFile;
    if (!registrationFile && agent.agentURI) {
        registrationFile = await resolveMetadata(agent.agentURI);
    }

    return {
        agent: { ...agent, metadataUri: agent.agentURI, registrationFile },
        feedback: agent.feedback || [],
    };
}

/**
 * Counts agents matching the given filters
 *
 * Since The Graph doesn't provide a direct count query, we fetch only agent IDs
 * with a high limit and count the results. This is efficient because we only
 * request the id field.
 *
 * @param filters - Optional filters (search, hasReviews, hasEndpoint)
 * @returns Number of agents matching the filters
 */
export async function fetchAgentCount(filters?: AgentFilters): Promise<number> {
    // Build where clause using the same logic as fetchAgents
    const conditions: string[] = [];

    if (filters?.search) {
        conditions.push(`{ registrationFile_: { name_contains_nocase: "${filters.search}" } }`);
    }

    if (filters?.hasReviews) {
        conditions.push(`{ totalFeedback_gt: 0 }`);
    }

    if (filters?.hasEndpoint) {
        conditions.push(`{ or: [
            { registrationFile_: { mcpEndpoint_not: null } },
            { registrationFile_: { a2aEndpoint_not: null } }
        ] }`);
    }

    let whereClause = "";
    if (conditions.length === 1) {
        whereClause = `where: ${conditions[0]}`;
    } else if (conditions.length > 1) {
        whereClause = `where: { and: [${conditions.join(", ")}] }`;
    }

    // Fetch only IDs with a high limit (lightweight query)
    const query = `
    {
      agents(
        first: 1000
        ${whereClause}
      ) {
        id
      }
    }
  `;

    const data = (await querySubgraph(query)) as { agents: { id: string }[] };
    return data.agents.length;
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
 * Resolves and fetches metadata from a URI
 *
 * The subgraph only decodes IPFS metadata. For HTTP URLs and base64 data URIs,
 * we need to fetch and decode the metadata ourselves.
 *
 * @param uri - The metadata URI (ipfs://, http://, https://, or data:)
 * @returns Parsed metadata object or null if fetch fails
 */
async function resolveMetadata(uri: string): Promise<Agent["registrationFile"]> {
    try {
        let jsonData: string;

        if (uri.startsWith("data:")) {
            // Base64 data URI: data:application/json;base64,eyJuYW1lIjoi...
            const base64Match = uri.match(/^data:[^;]+;base64,(.+)$/);
            if (!base64Match) return null;
            jsonData = atob(base64Match[1]);
        } else if (uri.startsWith("http://") || uri.startsWith("https://")) {
            // HTTP URL: fetch directly
            const response = await fetch(uri);
            if (!response.ok) return null;
            jsonData = await response.text();
        } else if (uri.startsWith("ipfs://")) {
            // IPFS: use a public gateway
            const hash = uri.replace("ipfs://", "");
            const response = await fetch(`https://ipfs.io/ipfs/${hash}`);
            if (!response.ok) return null;
            jsonData = await response.text();
        } else {
            return null;
        }

        const metadata = JSON.parse(jsonData);

        // Map to our registrationFile structure
        return {
            name: metadata.name || null,
            description: metadata.description || null,
            image: metadata.image || null,
            mcpEndpoint: metadata.mcpEndpoint || null,
            a2aEndpoint: metadata.a2aEndpoint || null,
            supportedTrusts: metadata.supportedTrusts || null,
        };
    } catch {
        return null;
    }
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
