import { validateEnv } from "./config/env.js";
import ConnectDB from "./db/index.js";
import app from "./app.js";
import mongoose from "mongoose";

validateEnv();

let server;

function shutdown(signal) {
  console.log(`${signal} received, shutting down gracefully`);
  const force = setTimeout(() => {
    console.error("Forced shutdown");
    process.exit(1);
  }, 10000);
  force.unref();

  const closeServer = server
    ? new Promise((resolve) => server.close(resolve))
    : Promise.resolve();

  closeServer
    .then(() => mongoose.connection.close(false))
    .then(() => {
      console.log("HTTP server and MongoDB closed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error during shutdown", error);
      process.exit(1);
    });
}

ConnectDB()
  .then(() => {
    const port = process.env.PORT || 8000;
    server = app.listen(port, () => {
      console.log(`server is running on port ${port}`);
    });

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  })
  .catch((error) => {
    console.error("Mongodb connection failed !!", error);
    process.exit(1);
  });
