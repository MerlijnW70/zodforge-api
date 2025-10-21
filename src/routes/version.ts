// API version information endpoint
import { FastifyInstance } from 'fastify';
import { getVersionInfo } from '../middleware/versioning.js';

/**
 * Version information endpoint
 */
export async function versionRoute(fastify: FastifyInstance) {
  /**
   * GET /version - Get API version information
   */
  fastify.get('/version', async (_request, reply) => {
    const versionInfo = getVersionInfo();

    reply.code(200).send({
      success: true,
      ...versionInfo,
    });
  });
}
