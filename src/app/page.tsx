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

// =============================================================================
// Constants
// =============================================================================

/** Available page size options (multiples of 3 for grid layout) */
const PAGE_SIZES = [12, 24, 48, 99];

/** Default page size */
const DEFAULT_PAGE_SIZE = 24;

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

// =============================================================================
// Components
// =============================================================================

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

// =============================================================================
// Page Component
// =============================================================================

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
                        <span className="text-sm text-white/50">Results for &quot;{search}&quot;</span>
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
