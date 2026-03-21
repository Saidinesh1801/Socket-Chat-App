import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Socket Chat App API',
      version: '1.0.0',
      description: 'Real-time chat application API with Socket.IO',
      contact: {
        name: 'API Support'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            avatar: { type: 'string' },
            status: { type: 'string' }
          }
        },
        Message: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            room: { type: 'string' },
            user: { type: 'string' },
            text: { type: 'string' },
            time: { type: 'string' },
            status: { type: 'string', enum: ['sent', 'delivered', 'seen'] }
          }
        },
        Room: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            creator: { type: 'string' },
            hasPassword: { type: 'boolean' },
            isDM: { type: 'boolean' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    },
    security: [{
      bearerAuth: []
    }]
  },
  apis: ['./routes/*.ts', './server.ts']
};

const swaggerSpec = swaggerJsdoc(options);

export { swaggerSpec };
