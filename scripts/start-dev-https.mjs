import { createServer } from "vite";
import devCerts from "office-addin-dev-certs";

const httpsOptions = await devCerts.getHttpsServerOptions();
const server = await createServer({
  server: {
    https: httpsOptions,
    port: 3000,
    strictPort: true,
    headers: {
      "Access-Control-Allow-Origin": "*"
    }
  }
});

await server.listen();
server.printUrls();
