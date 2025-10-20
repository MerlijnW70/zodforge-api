// AI schema refinement endpoint
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { providerFactory } from '../lib/providers/factory.js';
import type { RefinementRequest, RefinementResponse } from '../types/index.js';

// Zod schema for request validation
const RefinementRequestSchema = z.object({
  schema: z.object({
    code: z.string().min(1).max(50000), // Max 50KB schema
    typeName: z.string().min(1).max(255),
    fields: z.record(z.string(), z.string()),
  }),
  samples: z.array(z.any()).min(1).max(100), // Max 100 samples
  options: z.object({
    provider: z.enum(['openai', 'anthropic', 'auto']).optional(),
    model: z.string().optional(),
    temperature: z.number().min(0).max(1).optional(),
  }).optional(),
});

export async function refineRoute(fastify: FastifyInstance) {
  // Apply authentication middleware to this route
  fastify.addHook('preHandler', authMiddleware);

  fastify.post<{ Body: RefinementRequest }>('/refine', async (request, reply) => {
    try {
      // Validate request body
      const validatedRequest = RefinementRequestSchema.parse(request.body);

      // Use provider factory for refinement (supports OpenAI, Anthropic, and auto fallback)
      const result = await providerFactory.refineSchema(validatedRequest as RefinementRequest);

      const response: RefinementResponse = {
        success: true,
        ...result,
      };

      reply.code(200).send(response);
    } catch (error: any) {
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid request format',
          errorCode: 'INVALID_REQUEST',
        } as RefinementResponse);
      }

      // Handle provider errors (OpenAI, Anthropic, or all providers failed)
      if (error.message?.includes('API error') || error.message?.includes('provider')) {
        return reply.code(500).send({
          success: false,
          error: error.message,
          errorCode: 'AI_PROVIDER_ERROR',
        } as RefinementResponse);
      }

      // Generic error
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error',
        errorCode: 'INTERNAL_ERROR',
      } as RefinementResponse);
    }
  });
}
