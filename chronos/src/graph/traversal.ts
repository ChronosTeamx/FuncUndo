import { GraphNode, IntraFileEdge } from '../lib/types';

// ─── STUB REGISTRY (swap with Assignment 23 when ready) ──────────────────────
// Key format: "absoluteURI::functionName"
const globalRegistry = new Map<string, GraphNode>();

export function makeNodeKey(fileURI: string, functionName: string): string {
    return `${fileURI}::${functionName}`;
}

function getOrCreateNode(key: string): GraphNode {
    if (!globalRegistry.has(key)) {
        globalRegistry.set(key, {
            outboundEdges: new Set(),
            inboundEdges: new Set(),
            deepInboundCache: null,
        });
    }
    return globalRegistry.get(key)!;
}

// ─── ASSIGNMENT 24A: Build Graph from edges ───────────────────────────────────
export function registerFileEdges(
    fileURI: string,
    edges: IntraFileEdge[]
): void {
    for (const edge of edges) {
        const callerKey = makeNodeKey(fileURI, edge.callerName);
        const calleeKey = makeNodeKey(fileURI, edge.calleeName);

        const callerNode = getOrCreateNode(callerKey);
        const calleeNode = getOrCreateNode(calleeKey);

        // outbound: caller → callee
        callerNode.outboundEdges.add(calleeKey);

        // inbound: callee ← caller
        calleeNode.inboundEdges.add(callerKey);

        // invalidate memoization cache on new edge
        calleeNode.deepInboundCache = null;

        console.log(`[Graph] Edge registered: ${edge.callerName} → ${edge.calleeName}`);
    }
}

// ─── ASSIGNMENT 24B: DFS with cycle detection ─────────────────────────────────
// Answers: "what does this function depend on?"
export function getDependencies(
    startKey: string,
    visited: Set<string> = new Set()
): Set<string> {
    // O(1) cycle detection — sever immediately
    if (visited.has(startKey)) {
        console.warn(`[Graph] Cycle detected at: ${startKey} — severed`);
        return visited;
    }

    visited.add(startKey);

    const node = globalRegistry.get(startKey);
    if (!node) return visited;

    for (const dep of node.outboundEdges) {
        getDependencies(dep, visited);
    }

    return visited;
}

// ─── ASSIGNMENT 24C: Reverse dependency graph ────────────────────────────────
// Answers: "who breaks if this function changes?"
export function getImpactedFunctions(
    startKey: string,
    visited: Set<string> = new Set()
): Set<string> {
    // O(1) cycle detection
    if (visited.has(startKey)) {
        console.warn(`[Graph] Cycle detected at: ${startKey} — severed`);
        return visited;
    }

    visited.add(startKey);

    const node = globalRegistry.get(startKey);
    if (!node) return visited;

    // Use memoization cache if available
    if (node.deepInboundCache !== null) {
        console.log(`[Graph] Cache hit for: ${startKey}`);
        for (const cached of node.deepInboundCache) {
            visited.add(cached);
        }
        return visited;
    }

    // Walk inbound edges — who calls this function?
    for (const caller of node.inboundEdges) {
        getImpactedFunctions(caller, visited);
    }

    // Store result in memoization cache
    node.deepInboundCache = new Set(visited);

    return visited;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Get all direct callers of a function (one level only)
export function getDirectCallers(key: string): string[] {
    const node = globalRegistry.get(key);
    if (!node) return [];
    return Array.from(node.inboundEdges);
}

// Get all direct callees of a function (one level only)
export function getDirectCallees(key: string): string[] {
    const node = globalRegistry.get(key);
    if (!node) return [];
    return Array.from(node.outboundEdges);
}

// Check if a key exists in the registry
export function hasNode(key: string): boolean {
    return globalRegistry.has(key);
}

// Get full registry snapshot (useful for debugging)
export function getRegistrySnapshot(): Map<string, GraphNode> {
    return new Map(globalRegistry);
}

// Clear registry (useful for testing)
export function clearRegistry(): void {
    globalRegistry.clear();
}

//  for testing purposes only

export function debugGraph(fileURI: string, functionName: string): void {
    const key = makeNodeKey(fileURI, functionName);

    console.log(`\n[Graph Debug] ─────────────────────────────`);
    console.log(`[Graph Debug] Target: ${functionName}`);

    const node = globalRegistry.get(key);
    if (!node) {
        console.log(`[Graph Debug] Node not found in registry`);
        return;
    }

    console.log(`[Graph Debug] Direct callees (calls):`, Array.from(node.outboundEdges));
    console.log(`[Graph Debug] Direct callers (called by):`, Array.from(node.inboundEdges));

    const dependencies = getDependencies(key);
    console.log(`[Graph Debug] All dependencies (deep):`, Array.from(dependencies));

    const impacted = getImpactedFunctions(key);
    console.log(`[Graph Debug] All impacted functions (deep):`, Array.from(impacted));
    console.log(`[Graph Debug] ─────────────────────────────\n`);
}