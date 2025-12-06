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
  const nonReadable = str
    .split("")
    .filter((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) > 126).length;
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
        <span className="shrink-0 text-xs text-white/40">
          {formatTimestamp(feedback.createdAt)}
        </span>
      </div>

      {/* Review text */}
      {text && (
        <p className="mb-3 text-sm leading-relaxed text-white/70">{text}</p>
      )}

      {/* Tags and capabilities */}
      <div className="flex flex-wrap items-center gap-2">
        {tag1 && (
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-white/60">
            {tag1}
          </span>
        )}
        {tag2 && (
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-white/60">
            {tag2}
          </span>
        )}
        {capability && (
          <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">
            {capability}
          </span>
        )}
        {skill && (
          <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
            {skill}
          </span>
        )}
      </div>

      {/* Reviewer address */}
      <div className="mt-3 border-t border-white/5 pt-3">
        <span className="font-mono text-xs text-white/40">
          by {formatAddress(feedback.clientAddress)}
        </span>
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
      ? Math.round(
          feedback.reduce((acc, f) => acc + parseInt(f.score), 0) /
            feedback.length
        )
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
                <span className="text-2xl font-bold text-white/30">
                  {name.charAt(0).toUpperCase()}
                </span>
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
                  <span className="text-sm text-white/50">
                    ({totalFeedback} reviews)
                  </span>
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
                  <p className="mt-0.5 font-mono text-white/70">
                    {formatAddress(agent.owner)}
                  </p>
                </div>

                {/* Created date */}
                <div>
                  <span className="text-white/40">Created</span>
                  <p className="mt-0.5 text-white/70">
                    {formatTimestamp(agent.createdAt)}
                  </p>
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
                <h2 className="mb-3 text-sm font-medium text-white/70">
                  Description
                </h2>
                <p className="text-sm leading-relaxed text-white/60">
                  {description}
                </p>
              </div>
            )}
          </div>

          {/* Right column: Reviews */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-lg font-medium text-white">
              Reviews ({feedback.length})
            </h2>

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
