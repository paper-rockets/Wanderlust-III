import net from 'net';

async function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve({ port, free: false });
      } else {
        resolve({ port, free: false, error: err.code });
      }
    });
    server.once('listening', () => {
      server.close(() => {
        resolve({ port, free: true });
      });
    });
    server.listen(port, '0.0.0.0');
  });
}

async function main() {
  console.log('--- Checking Ports 3000-3015 ---');
  for (let p = 3000; p <= 3015; p++) {
    const res = await checkPort(p);
    console.log(`Port ${p}: ${res.free ? 'FREE' : 'IN USE'}`);
  }
}

main().catch(console.error);
