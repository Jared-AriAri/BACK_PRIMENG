const fastify = require('fastify')({ logger: true });
const proxy = require('@fastify/http-proxy');
const cors = require('@fastify/cors');
const jwt = require('@fastify/jwt');
const buildGetJwks = require('get-jwks');

const getJwks = buildGetJwks();

fastify.register(jwt, {
    decode: { complete: true },
    secret: async (request, token) => {
        const { kid, alg } = token.header;
        const { iss } = token.payload;
        return getJwks.getPublicKey({ kid, alg, domain: iss });
    },
    verify: {
        algorithms: ['RS256', 'ES256'],
        allowedIss: 'https://ikhaimvtmtclvdddhvtf.supabase.co/auth/v1'
    }
});

fastify.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

const validateSecurity = async (request, reply) => {
    if (request.method === 'OPTIONS') return;
    if (request.url.includes('/me')) return;

    try {
        await request.jwtVerify();
        const user = request.user;
        const perms = [
            ...(user.app_metadata?.permissions || []),
            ...(user.user_metadata?.permissions || []),
            ...(user.permissions || [])
        ];

        const { method, url } = request;

        if (url.startsWith('/ticket') && method === 'POST') {
            const hasTicketPerm = perms.includes('ticket:create') || perms.includes('admin');
            if (!hasTicketPerm && perms.length === 0) {
                return reply.code(403).send({ error: 'AUTH403', message: 'Sin permisos' });
            }
        }

        if (url.startsWith('/user') && method !== 'GET') {
            const hasUserPerm = perms.includes('admin') || perms.includes('user:edit');
            if (!hasUserPerm && perms.length === 0) {
                return reply.code(403).send({ error: 'AUTH403', message: 'Acceso denegado' });
            }
        }
    } catch (err) {
        return reply.code(401).send({ error: 'AUTH401', message: 'Sesión inválida' });
    }
};

fastify.register(proxy, {
    upstream: 'http://localhost:3004',
    prefix: '/auth',
    rewritePrefix: '/'
});

fastify.register(proxy, {
    upstream: 'http://localhost:3001',
    prefix: '/user',
    rewritePrefix: '/',
    preHandler: validateSecurity
});

fastify.register(proxy, {
    upstream: 'http://localhost:3002',
    prefix: '/ticket',
    rewritePrefix: '/ticket',
    preHandler: validateSecurity
});

fastify.register(proxy, {
    upstream: 'http://localhost:3003',
    prefix: '/group',
    rewritePrefix: '/',
    preHandler: validateSecurity
});

fastify.listen({ port: 3000, host: '0.0.0.0' }, (err) => {
    if (err) process.exit(1);
    console.log('✅ Gateway listo');
});