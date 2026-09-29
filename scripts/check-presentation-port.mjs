import net from 'node:net';
const port = Number(process.env.PORT || 3000);
const probe = net.createServer();
probe.once('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is already in use. Close the previous presentation terminal, then run START-PRESENTATION again.`
    : `Cannot start on port ${port}: ${error.message}`);
  process.exitCode = 1;
});
probe.listen(port, '127.0.0.1', () => probe.close());
