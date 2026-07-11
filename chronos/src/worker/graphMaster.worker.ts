import { parentPort } from 'worker_threads';
import { GlobalSymbolRegistry } from '../graph/GlobalRegistry';
import { GraphMasterIncoming } from '../lib/types';

if (!parentPort) {
  throw new Error('Fatal: graphMaster.worker.ts must be run as a Node.js Worker thread.');
}


console.log('[Graph Master] Booting Immortal State Worker...');

const globalRegistry = new GlobalSymbolRegistry();

parentPort.on('message', (message: GraphMasterIncoming) => {
  try {
    if (message.type === 'UPDATE_FIREWALL') {
      globalRegistry.setFirewall(message.validFiles, message.aliases);
      console.log(`[Graph Master] RAM Firewall synced: ${message.validFiles.length} files.`);
    }

    if (message.type === 'INGEST_PAYLOAD') {
      globalRegistry.ingestPayload(message.payload);
      globalRegistry.buildDirectedGraph();
    }

    if (message.type === 'QUERY_BLAST_RADIUS') {
      const { queryId, targetURI, functionName } = message;
      const uuid = GlobalSymbolRegistry.generateUUID(targetURI, functionName);

      // ✅ replace (globalRegistry as any).directedGraph.get(uuid)
      const node = globalRegistry.getNode(uuid);
      const blastRadiusCount = node ? node.inboundEdges.size : 0;

      parentPort?.postMessage({
        type: 'QUERY_BLAST_RADIUS_RESPONSE',
        queryId,
        blastRadiusCount,
      });
    }
  } catch (error) {
    console.error('[Graph Master Internal Error]', error);
  }

}
);
