/**
 * Liveness probe — `/api/health` répond toujours 200 si le process Node
 * tourne. Pour load balancers / orchestrators (k8s liveness, ALB
 * `healthcheck`). Aucun appel DB ou réseau ici — on veut un PASS dès que
 * le process accepte les sockets HTTP.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
