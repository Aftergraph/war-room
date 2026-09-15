/**
 * Aftergraph War Room — Server Entry Point
 * Starts the Full War Room API, SSE Realtime Hub, and Operator Cockpit.
 */
const { server } = require('./apps/api/src/server');

const PORT = process.env.PORT || 3333;

server.listen(PORT, () => {
  console.log(`[Aftergraph War Room] Full Intelligence Operating Environment active on http://localhost:${PORT}`);
});
