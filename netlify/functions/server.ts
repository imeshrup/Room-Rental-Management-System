import serverless from "serverless-http";
import { app, startServer } from "../../server";

// Ensure database is initialized
let initialized = false;

export const handler = async (event: any, context: any) => {
  if (!initialized) {
    await startServer();
    initialized = true;
  }
  
  const serverlessHandler = serverless(app);
  return await serverlessHandler(event, context);
};
