# How to Build an ERC-8004 Agent Discovery App - In 10 Minutes

AI agents are becoming a core primitive in Web3. With the **ERC-8004 standard**, agents can be registered on-chain with verifiable identity, reputation, and discoverability. If you want to **learn how to build an agent discovery app**, you're in the right place.

In this tutorial, you'll build a fully functional agent explorer using **Next.js** and **The Graph** to query on-chain agent data. No blockchain or smart contract experience required. We'll be reading data from an existing subgraph.

> **📦 Follow Along**
>
> Clone the complete repository to follow along or reference the finished code:
>
> ```bash
> git clone https://github.com/vitto/8004-agent-explorer.git
> cd 8004-agent-explorer
> npm install
> npm run dev
> ```

By the end of this tutorial **you'll learn**:

-   What ERC-8004 is and why it matters for AI agents
-   How to query blockchain data using The Graph (subgraphs)
-   How to build a paginated listing page with search and filters
-   How to display agent details and reviews
-   Server-side rendering with Next.js App Router

That said, let's dig straight into **building your agent discovery app**.

---

## What is ERC-8004?

**ERC-8004** is an Ethereum standard for on-chain AI agent identity. Think of it like an NFT, but specifically designed for AI agents. Each registered agent gets:

-   **A unique on-chain identity** (token ID)
-   **Metadata** (name, description, capabilities, endpoints)
-   **Reputation data** (reviews and scores from users)
-   **Trust models** (verification and validation mechanisms)

This creates a decentralized registry where agents can be discovered, verified, and rated.

The [Agent0 protocol](https://agent0.xyz) has deployed ERC-8004 registries and provides a public subgraph that indexes all registered agents and their feedback.

---

## Prerequisites

Before starting, make sure you have:

-   **Node.js 18+** installed
-   Basic knowledge of **React** and **TypeScript**
-   A code editor (VS Code recommended)

No wallet or cryptocurrency needed. We're only reading public blockchain data.

---

## Step 1: Set Up The Next.js Project

Let's create a new Next.js project. Open your terminal and run:

```bash
npx create-next-app@latest agent-discovery --typescript --tailwind --app
```

When prompted, select these options:

-   ESLint: **Yes**
-   Tailwind CSS: **Yes**
-   `src/` directory: **Yes**
-   App Router: **Yes**
-   Turbopack: **Yes**

{add-screenshot}

Navigate into your project and install one additional dependency for icons:

```bash
cd agent-discovery
npm install lucide-react
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your app running.

{add-screenshot}

---

## Step 2: Understanding The Data Source

We'll fetch agent data from **The Graph**, a decentralized indexing protocol that makes blockchain data queryable via GraphQL.

Agent0 has deployed a subgraph that indexes all ERC-8004 agents on Ethereum Sepolia. Here's the endpoint we'll use:

```
https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT
```

The subgraph provides:

-   **Agents** — registered agent identities with metadata
-   **Feedback** — reviews and scores for each agent
-   **GlobalStats** — total counts across the registry

Let's create a client to query this data.

---

## Step 3: Create The Subgraph Client

Create a new file at `src/lib/subgraph.ts`. This module will handle all our GraphQL queries.

First, define the endpoint and TypeScript interfaces:

```typescript
// src/lib/subgraph.ts

/**
 * Subgraph client for querying ERC-8004 agents from The Graph
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
        mcpEndpoint: string | null; // Model Context Protocol endpoint
        a2aEndpoint: string | null; // Agent-to-Agent endpoint
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
```

The `Agent` interface represents an ERC-8004 agent with its on-chain identity and metadata. The `registrationFile` contains the off-chain metadata like name, description, and API endpoints.

Next, add the filter types and helper functions. Note that the subgraph only decodes IPFS metadata automatically. For HTTP URLs and base64 data URIs, we need a fallback to fetch and decode the metadata ourselves:

```typescript
/**
 * Filter options for fetching agents
 */
export interface AgentFilters {
    search?: string; // Search by agent name
    hasReviews?: boolean; // Only agents with reviews
    hasEndpoint?: boolean; // Only agents with MCP or A2A endpoint
}

/**
 * Resolves and fetches metadata from a URI
 *
 * The subgraph only decodes IPFS metadata. For HTTP URLs and base64 data URIs,
 * we need to fetch and decode the metadata ourselves.
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
```

Now add the main function to fetch a paginated list of agents. Note that The Graph doesn't allow mixing `or` with other filters at the same level, so we use `and` to properly combine conditions:

```typescript
/**
 * Fetches a paginated list of agents from the subgraph
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
```

The `resolveMetadata` fallback is important because agents can store their metadata in different ways:

-   **IPFS** (`ipfs://...`) — The subgraph decodes this automatically
-   **HTTP** (`https://...`) — We fetch it directly
-   **Base64** (`data:application/json;base64,...`) — We decode the base64 string

Add a function to fetch a single agent with its reviews:

```typescript
/**
 * Fetches a single agent with its feedback/reviews
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
```

Add a function to count agents matching filters. Since The Graph doesn't provide a direct count query, we fetch only agent IDs and count the results:

```typescript
/**
 * Counts agents matching the given filters
 *
 * Since The Graph doesn't provide a direct count query, we fetch only agent IDs
 * with a high limit and count the results. This is efficient because we only
 * request the id field.
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
```

Finally, add a function to fetch global statistics:

```typescript
/**
 * Fetches global statistics from the subgraph
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
```

Your complete `subgraph.ts` file is now ready. This gives us four main functions:

-   `fetchAgents()` — paginated list with filters (with metadata fallback)
-   `fetchAgentCount()` — count agents matching filters (for pagination)
-   `fetchAgentWithFeedback()` — single agent with reviews (with metadata fallback)
-   `fetchGlobalStats()` — total counts

The `resolveMetadata` helper ensures we can display agent information regardless of where the metadata is stored (IPFS, HTTP, or base64).

---

## Step 4: Create The Page Size Selector Component

Since we want a dropdown for page size selection, we need a client component (server components can't have event handlers). Create `src/components/PageSizeSelect.tsx`:

```typescript
// src/components/PageSizeSelect.tsx

"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

interface PageSizeSelectProps {
    currentSize: number;
    sizes: number[];
    /** Current URL params to preserve when changing page size */
    currentParams: Record<string, string | undefined>;
}

export function PageSizeSelect({ currentSize, sizes, currentParams }: PageSizeSelectProps) {
    const router = useRouter();

    const handleChange = (newSize: number) => {
        const params = new URLSearchParams();
        Object.entries(currentParams).forEach(([key, value]) => {
            if (key === "perPage") {
                // Only add perPage if not default (24)
                if (newSize !== 24) params.set("perPage", String(newSize));
            } else if (key === "page") {
                // Reset to page 1 when changing size
                // Don't add page=1 to URL
            } else if (value) {
                params.set(key, value);
            }
        });
        const query = params.toString();
        router.push(query ? `/?${query}` : "/");
    };

    return (
        <div className="relative">
            <select
                value={currentSize}
                onChange={(e) => handleChange(parseInt(e.target.value))}
                className="appearance-none rounded-lg border border-white/10 bg-white/5 py-1.5 pl-3 pr-8 text-sm text-white/70 outline-none focus:border-white/20"
            >
                {sizes.map((size) => (
                    <option key={size} value={size} className="bg-[#0a0a0b]">
                        {size}
                    </option>
                ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        </div>
    );
}
```

This component uses Next.js's `useRouter` to navigate when the dropdown changes while preserving other URL parameters.

---

## Step 5: Build The Agent Listing Page

Replace the contents of `src/app/page.tsx` with our agent listing page. Let's break it down into sections.

### 5.1 Imports and Constants

```typescript
// src/app/page.tsx

/**
 * Agent Listing Page
 *
 * Displays a paginated grid of ERC-8004 agents fetched from the subgraph.
 * Supports search, filtering, and configurable pagination.
 */

import { fetchAgents, fetchAgentCount, fetchGlobalStats, AgentFilters } from "@/lib/subgraph";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { Search, Filter } from "lucide-react";
import Link from "next/link";

/** Available page size options (multiples of 3 for grid layout) */
const PAGE_SIZES = [12, 24, 48, 99];

/** Default page size */
const DEFAULT_PAGE_SIZE = 24;
```

### 5.2 Helper Functions

Add utility functions for formatting data and building URLs:

```typescript
/** Truncates an Ethereum address to "0x1234...5678" format */
function formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Converts Unix timestamp to readable date */
function formatTimestamp(timestamp: string): string {
    const date = new Date(parseInt(timestamp) * 1000);
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

/** Builds URL with current params, updating specified values */
function buildUrl(params: Record<string, string | undefined>, updates: Record<string, string | undefined>): string {
    const merged = { ...params, ...updates };
    const searchParams = new URLSearchParams();

    Object.entries(merged).forEach(([key, value]) => {
        if (value && value !== "1" && !(key === "perPage" && value === String(DEFAULT_PAGE_SIZE))) {
            searchParams.set(key, value);
        }
    });

    const query = searchParams.toString();
    return query ? `/?${query}` : "/";
}
```

### 5.3 Agent Card Component

Create a component to display each agent:

```typescript
/** Props for the AgentCard component */
interface AgentCardProps {
    agent: {
        id: string;
        agentId: string;
        owner: string;
        createdAt: string;
        totalFeedback: string;
        registrationFile: {
            name: string | null;
            description: string | null;
            image: string | null;
            supportedTrusts: string[] | null;
            mcpEndpoint: string | null;
            a2aEndpoint: string | null;
        } | null;
    };
}

/** Displays a single agent as a clickable card */
function AgentCard({ agent }: AgentCardProps) {
    const name = agent.registrationFile?.name || `Agent #${agent.agentId}`;
    const description = agent.registrationFile?.description;
    const trusts = agent.registrationFile?.supportedTrusts || [];
    const feedbackCount = parseInt(agent.totalFeedback);
    const hasEndpoint = agent.registrationFile?.mcpEndpoint || agent.registrationFile?.a2aEndpoint;

    return (
        <Link
            href={`/agent/${encodeURIComponent(agent.id)}`}
            className="group block rounded-xl border border-white/10 bg-white/[0.02] p-5 transition-all hover:border-white/20 hover:bg-white/[0.04]"
        >
            {/* Header: Name and badges */}
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium text-white/90">{name}</h3>
                    <p className="mt-0.5 font-mono text-xs text-white/40">ID: {agent.agentId}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                    {hasEndpoint && (
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">API</span>
                    )}
                    {feedbackCount > 0 && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                            {feedbackCount}
                        </span>
                    )}
                </div>
            </div>

            {/* Description (truncated to 2 lines) */}
            {description && <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-white/50">{description}</p>}

            {/* Trust model badges */}
            {trusts.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-1.5">
                    {trusts.slice(0, 3).map((trust) => (
                        <span key={trust} className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-white/60">
                            {trust}
                        </span>
                    ))}
                </div>
            )}

            {/* Footer: Owner address and creation date */}
            <div className="flex items-center justify-between border-t border-white/5 pt-3 text-xs text-white/40">
                <span>Owner: {formatAddress(agent.owner)}</span>
                <span>{formatTimestamp(agent.createdAt)}</span>
            </div>
        </Link>
    );
}
```

### 5.4 Filter Button Component

A reusable toggle button for filters:

```typescript
/** Filter toggle button */
function FilterButton({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
    return (
        <a
            href={href}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                active
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/70"
            }`}
        >
            {children}
        </a>
    );
}
```

### 5.5 Main Page Component

Now the main page component that ties everything together:

```typescript
/** URL search params for the page */
interface SearchParams {
    search?: string;
    page?: string;
    perPage?: string;
    hasReviews?: string;
    hasEndpoint?: string;
}

interface PageProps {
    searchParams: Promise<SearchParams>;
}

export default async function Home({ searchParams }: PageProps) {
    // Parse URL search params
    const params = await searchParams;
    const search = params.search || "";
    const page = parseInt(params.page || "1");
    const perPage = parseInt(params.perPage || String(DEFAULT_PAGE_SIZE));
    const hasReviews = params.hasReviews === "true";
    const hasEndpoint = params.hasEndpoint === "true";

    // Validate perPage
    const pageSize = PAGE_SIZES.includes(perPage) ? perPage : DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * pageSize;

    // Build filters object
    const filters: AgentFilters = {
        search: search || undefined,
        hasReviews: hasReviews || undefined,
        hasEndpoint: hasEndpoint || undefined,
    };

    // Current params for URL building
    const currentParams: Record<string, string | undefined> = {
        search: search || undefined,
        page: String(page),
        perPage: String(pageSize),
        hasReviews: hasReviews ? "true" : undefined,
        hasEndpoint: hasEndpoint ? "true" : undefined,
    };

    // Check if any filters are active
    const hasActiveFilters = hasReviews || hasEndpoint || search;

    // Fetch agents and stats from subgraph (runs on server)
    // When filters are active, we need to count filtered results for accurate pagination
    const [agents, stats, filteredCount] = await Promise.all([
        fetchAgents(pageSize, skip, filters),
        fetchGlobalStats(),
        hasActiveFilters ? fetchAgentCount(filters) : Promise.resolve(null),
    ]);

    // Use filtered count for pagination when filters are active, otherwise use global total
    const totalAgents = filteredCount ?? parseInt(stats.totalAgents);
    const totalPages = Math.ceil(totalAgents / pageSize);

    return (
        <div className="min-h-screen bg-[#0a0a0b]">
            {/* Header with title and search */}
            <header className="border-b border-white/5">
                <div className="mx-auto max-w-7xl px-6 py-6">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                        {/* Title and agent count */}
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight text-white">8004 Agents Explorer</h1>
                            <p className="mt-1 text-sm text-white/50">
                                {hasActiveFilters
                                    ? `${totalAgents.toLocaleString()} matching agents`
                                    : `${totalAgents.toLocaleString()} registered agents on Ethereum Sepolia`}
                            </p>
                        </div>

                        {/* Search form */}
                        <form action="/" method="GET" className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                            <input
                                type="text"
                                name="search"
                                placeholder="Search agents..."
                                defaultValue={search}
                                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none focus:border-white/20"
                            />
                            {/* Preserve other filters when searching */}
                            {hasReviews && <input type="hidden" name="hasReviews" value="true" />}
                            {hasEndpoint && <input type="hidden" name="hasEndpoint" value="true" />}
                            {pageSize !== DEFAULT_PAGE_SIZE && <input type="hidden" name="perPage" value={pageSize} />}
                        </form>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="mx-auto max-w-7xl px-6 py-8">
                {/* Filters bar */}
                <div className="mb-6 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-white/50">
                        <Filter className="h-4 w-4" />
                        <span>Filters:</span>
                    </div>

                    <FilterButton
                        active={hasReviews}
                        href={buildUrl(currentParams, {
                            hasReviews: hasReviews ? undefined : "true",
                            page: "1",
                        })}
                    >
                        Has reviews
                    </FilterButton>

                    <FilterButton
                        active={hasEndpoint}
                        href={buildUrl(currentParams, {
                            hasEndpoint: hasEndpoint ? undefined : "true",
                            page: "1",
                        })}
                    >
                        Has API endpoint
                    </FilterButton>

                    {hasActiveFilters && (
                        <a
                            href="/"
                            className="ml-2 text-sm text-white/50 underline underline-offset-2 hover:text-white/70"
                        >
                            Clear all
                        </a>
                    )}
                </div>

                {/* Search result indicator */}
                {search && (
                    <div className="mb-6 flex items-center gap-2">
                        <span className="text-sm text-white/50">Results for "{search}"</span>
                    </div>
                )}

                {/* Agent grid or empty state */}
                {agents.length === 0 ? (
                    <div className="py-20 text-center">
                        <p className="text-white/50">No agents found</p>
                        {hasActiveFilters && (
                            <a
                                href="/"
                                className="mt-2 inline-block text-sm text-white/70 underline underline-offset-2 hover:text-white"
                            >
                                Clear filters
                            </a>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Agent cards grid */}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {agents.map((agent) => (
                                <AgentCard key={agent.id} agent={agent} />
                            ))}
                        </div>

                        {/* Pagination controls */}
                        <div className="mt-8 flex items-center justify-between">
                            {/* Left: Page size selector */}
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-white/50">Show:</span>
                                <PageSizeSelect
                                    currentSize={pageSize}
                                    sizes={PAGE_SIZES}
                                    currentParams={currentParams}
                                />
                            </div>

                            {/* Center: Page navigation */}
                            {totalPages > 1 && (
                                <div className="flex items-center gap-2">
                                    {page > 1 && (
                                        <a
                                            href={buildUrl(currentParams, { page: String(page - 1) })}
                                            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
                                        >
                                            Previous
                                        </a>
                                    )}
                                    <span className="px-4 py-2 text-sm text-white/50">
                                        Page {page} of {totalPages}
                                    </span>
                                    {page < totalPages && (
                                        <a
                                            href={buildUrl(currentParams, { page: String(page + 1) })}
                                            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
                                        >
                                            Next
                                        </a>
                                    )}
                                </div>
                            )}

                            {/* Right: Spacer for balance */}
                            <div className="w-24" />
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
```

Save the file and check your browser. You should see a grid of agents!

{add-screenshot}

### Key Concepts in This Page

1. **Server Component** — This is an async server component. The `fetchAgents()` and `fetchGlobalStats()` calls run on the server, not in the browser.

2. **URL-based State** — Search, filters, and pagination are stored in URL params. This makes the page shareable and back-button friendly.

3. **Client Component for Interactivity** — The `PageSizeSelect` dropdown is a separate client component since server components can't have event handlers.

4. **Progressive Enhancement** — Search and filters work without JavaScript using native form behavior and anchor tags.

---

## Step 6: Build The Agent Detail Page

Create the agent detail page at `src/app/agent/[id]/page.tsx`:

```bash
mkdir -p src/app/agent/\[id\]
touch src/app/agent/\[id\]/page.tsx
```

Add the following code:

```typescript
// src/app/agent/[id]/page.tsx

/**
 * Agent Detail Page
 *
 * Displays detailed information about a single agent including:
 * - Basic info (name, description, owner, creation date)
 * - Endpoints (MCP, A2A)
 * - Trust models
 * - Reviews/feedback from other users
 */

import { fetchAgentWithFeedback, Feedback } from "@/lib/subgraph";
import { ArrowLeft, ExternalLink, Star } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

// =============================================================================
// Helper Functions
// =============================================================================

/** Truncates an Ethereum address to "0x1234...5678" format */
function formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Converts Unix timestamp to readable date */
function formatTimestamp(timestamp: string): string {
    const date = new Date(parseInt(timestamp) * 1000);
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

/**
 * Checks if a string contains readable text (not garbled bytes)
 * Some tags in the subgraph contain binary data that displays as garbage
 */
function isReadableText(str: string | null): boolean {
    if (!str) return false;
    const nonReadable = str.split("").filter((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) > 126).length;
    return nonReadable / str.length < 0.3;
}

// =============================================================================
// Components
// =============================================================================

/** Visual score bar showing 0-100 rating */
function ScoreBar({ score }: { score: number }) {
    return (
        <div className="flex items-center gap-2">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500"
                    style={{ width: `${score}%` }}
                />
            </div>
            <span className="text-sm font-medium text-white/70">{score}/100</span>
        </div>
    );
}

/** Displays a single feedback/review */
function FeedbackCard({ feedback }: { feedback: Feedback }) {
    const score = parseInt(feedback.score);
    const text = feedback.feedbackFile?.text;
    const capability = feedback.feedbackFile?.capability;
    const skill = feedback.feedbackFile?.skill;

    // Filter out garbled/binary tags
    const tag1 = isReadableText(feedback.tag1) ? feedback.tag1 : null;
    const tag2 = isReadableText(feedback.tag2) ? feedback.tag2 : null;

    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            {/* Score and date */}
            <div className="mb-3 flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-400" />
                    <ScoreBar score={score} />
                </div>
                <span className="shrink-0 text-xs text-white/40">{formatTimestamp(feedback.createdAt)}</span>
            </div>

            {/* Review text */}
            {text && <p className="mb-3 text-sm leading-relaxed text-white/70">{text}</p>}

            {/* Tags and capabilities */}
            <div className="flex flex-wrap items-center gap-2">
                {tag1 && <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-white/60">{tag1}</span>}
                {tag2 && <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-white/60">{tag2}</span>}
                {capability && (
                    <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">{capability}</span>
                )}
                {skill && (
                    <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">{skill}</span>
                )}
            </div>

            {/* Reviewer address */}
            <div className="mt-3 border-t border-white/5 pt-3">
                <span className="font-mono text-xs text-white/40">by {formatAddress(feedback.clientAddress)}</span>
            </div>
        </div>
    );
}

// =============================================================================
// Page Component
// =============================================================================

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function AgentPage({ params }: PageProps) {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);

    // Fetch agent and feedback from subgraph
    const { agent, feedback } = await fetchAgentWithFeedback(decodedId);

    // Show 404 if agent not found
    if (!agent) {
        notFound();
    }

    // Extract agent metadata
    const name = agent.registrationFile?.name || `Agent #${agent.agentId}`;
    const description = agent.registrationFile?.description;
    const image = agent.registrationFile?.image;
    const trusts = agent.registrationFile?.supportedTrusts || [];
    const mcpEndpoint = agent.registrationFile?.mcpEndpoint;
    const a2aEndpoint = agent.registrationFile?.a2aEndpoint;
    const totalFeedback = parseInt(agent.totalFeedback);

    // Calculate average score from reviews
    const avgScore =
        feedback.length > 0
            ? Math.round(feedback.reduce((acc, f) => acc + parseInt(f.score), 0) / feedback.length)
            : null;

    return (
        <div className="min-h-screen bg-[#0a0a0b]">
            {/* Header with agent info */}
            <header className="border-b border-white/5">
                <div className="mx-auto max-w-4xl px-6 py-6">
                    {/* Back link */}
                    <Link
                        href="/"
                        className="mb-6 inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/70"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to all agents
                    </Link>

                    {/* Agent header with avatar */}
                    <div className="flex gap-6">
                        {/* Avatar or placeholder */}
                        {image ? (
                            <img
                                src={image}
                                alt={name}
                                className="h-20 w-20 shrink-0 rounded-2xl bg-white/5 object-cover"
                            />
                        ) : (
                            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-white/10 to-white/5">
                                <span className="text-2xl font-bold text-white/30">{name.charAt(0).toUpperCase()}</span>
                            </div>
                        )}

                        {/* Name and stats */}
                        <div className="min-w-0 flex-1">
                            <h1 className="text-2xl font-semibold text-white">{name}</h1>
                            <p className="mt-1 font-mono text-sm text-white/40">{agent.id}</p>

                            {/* Average score */}
                            {avgScore !== null && (
                                <div className="mt-3 flex items-center gap-3">
                                    <ScoreBar score={avgScore} />
                                    <span className="text-sm text-white/50">({totalFeedback} reviews)</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main content: details + reviews */}
            <main className="mx-auto max-w-4xl px-6 py-8">
                <div className="grid gap-8 lg:grid-cols-3">
                    {/* Left column: Agent details */}
                    <div className="lg:col-span-1">
                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                            <h2 className="mb-4 text-sm font-medium text-white/70">Details</h2>

                            <div className="space-y-4 text-sm">
                                {/* Owner */}
                                <div>
                                    <span className="text-white/40">Owner</span>
                                    <p className="mt-0.5 font-mono text-white/70">{formatAddress(agent.owner)}</p>
                                </div>

                                {/* Created date */}
                                <div>
                                    <span className="text-white/40">Created</span>
                                    <p className="mt-0.5 text-white/70">{formatTimestamp(agent.createdAt)}</p>
                                </div>

                                {/* Trust models */}
                                {trusts.length > 0 && (
                                    <div>
                                        <span className="text-white/40">Trust Models</span>
                                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                                            {trusts.map((trust) => (
                                                <span
                                                    key={trust}
                                                    className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-white/60"
                                                >
                                                    {trust}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* MCP Endpoint */}
                                {mcpEndpoint && (
                                    <div>
                                        <span className="text-white/40">MCP Endpoint</span>
                                        <a
                                            href={mcpEndpoint}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-0.5 flex items-center gap-1 text-blue-400 hover:underline"
                                        >
                                            <span className="truncate">{mcpEndpoint}</span>
                                            <ExternalLink className="h-3 w-3 shrink-0" />
                                        </a>
                                    </div>
                                )}

                                {/* A2A Endpoint */}
                                {a2aEndpoint && (
                                    <div>
                                        <span className="text-white/40">A2A Endpoint</span>
                                        <a
                                            href={a2aEndpoint}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-0.5 flex items-center gap-1 text-blue-400 hover:underline"
                                        >
                                            <span className="truncate">{a2aEndpoint}</span>
                                            <ExternalLink className="h-3 w-3 shrink-0" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Description card */}
                        {description && (
                            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
                                <h2 className="mb-3 text-sm font-medium text-white/70">Description</h2>
                                <p className="text-sm leading-relaxed text-white/60">{description}</p>
                            </div>
                        )}
                    </div>

                    {/* Right column: Reviews */}
                    <div className="lg:col-span-2">
                        <h2 className="mb-4 text-lg font-medium text-white">Reviews ({feedback.length})</h2>

                        {feedback.length === 0 ? (
                            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
                                <p className="text-white/50">No reviews yet</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {feedback.map((f) => (
                                    <FeedbackCard key={f.id} feedback={f} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
```

Click on any agent card to see the detail page:

{add-screenshot}

---

## Step 7: Test Your App

Make sure your development server is running:

```bash
npm run dev
```

Test the following features:

1. **Listing page** — See all registered agents
2. **Search** — Type a name in the search box
3. **Filters** — Toggle "Has reviews" and "Has API endpoint"
4. **Pagination** — Use the dropdown to change page size, navigate between pages
5. **Agent detail** — Click an agent to see details and reviews

{add-screenshot}

---

## Congratulations! 🎉

You've built a fully functional agent discovery app that:

-   ✅ Queries real blockchain data from The Graph
-   ✅ Displays paginated agent listings with search and filters
-   ✅ Shows agent details with reviews and ratings
-   ✅ Uses server-side rendering for fast initial loads
-   ✅ Works without JavaScript (progressive enhancement)

### What's Next?

Here are some ideas to extend your app:

1. **Multi-chain support** — Query agents from multiple networks
2. **Agent registration** — Add wallet connection to register new agents
3. **Review submission** — Allow users to submit feedback on-chain
4. **Semantic search** — Add AI-powered search with embeddings
5. **Agent interaction** — Call agent endpoints (MCP/A2A) directly

### Resources

-   [ERC-8004 Standard](https://eips.ethereum.org/EIPS/eip-8004)
-   [Agent0 Documentation](https://agent0.xyz)
-   [The Graph Documentation](https://thegraph.com/docs/)
-   [Next.js App Router](https://nextjs.org/docs/app)

---

## Complete Project Structure

```
agent-discovery/
├── src/
│   ├── app/
│   │   ├── agent/
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Agent detail page
│   │   ├── globals.css             # Tailwind styles
│   │   ├── layout.tsx              # Root layout
│   │   └── page.tsx                # Agent listing page
│   ├── components/
│   │   └── PageSizeSelect.tsx      # Page size dropdown (client component)
│   └── lib/
│       └── subgraph.ts             # GraphQL client
├── package.json
└── README.md
```

That's it! You now have a production-ready agent discovery app. Go explore the decentralized agent ecosystem! 🚀
