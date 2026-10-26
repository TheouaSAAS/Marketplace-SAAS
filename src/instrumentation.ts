import type { Instrumentation } from "next";

/**
 * Point d'entrée d'observabilité de Next : chaque erreur de rendu, d'action
 * ou de route serveur est journalisée et, si un canal est configuré, signalée.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportServerError } = await import("./server/error-reporting");
  await reportServerError(error, { path: request.path, method: request.method, routeType: context.routeType, routePath: context.routePath });
};
