const fastify = require('fastify')({ logger: true });
const proxy = require('@fastify/http-proxy');
const cors = require('@fastify/cors');
const jwt = require('@fastify/jwt');
const rateLimit = require('@fastify/rate-limit');
const buildGetJwks = require('get-jwks');

const getJwks = buildGetJwks();

const sendResponse = (reply, statusCode, intOpCode, data = null) => {
    return reply.code(statusCode).send({
        statusCode,
        intOpCode,
        data
    });
};

fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponse: () => ({
        statusCode: 429,
        intOpCode: 'GW429',
        data: 'Too many requests'
    })
});

fastify.register(jwt, {
    decode: { complete: true },
    secret: async (request, token) => {
        if (!token || !token.header || !token.payload) {
            throw new Error('Token inválido');
        }

        const { kid, alg } = token.header;
        const { iss } = token.payload;

        if (!kid || !alg || !iss) {
            throw new Error('Token sin kid, alg o iss');
        }

        return getJwks.getPublicKey({
            kid,
            alg,
            domain: iss
        });
    },
    verify: {
        algorithms: ['ES256'],
        allowedIss: 'https://ikhaimvtmtclvdddhvtf.supabase.co/auth/v1'
    }
});

fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
});

const validateSecurity = async (request, reply) => {
    if (request.method === 'OPTIONS') return;

    try {
        await request.jwtVerify();

        const user = request.user;
        const userPermissions =
            user.app_metadata?.permissions ||
            user.user_metadata?.permissions ||
            user.permissions ||
            [];

        const { method, url } = request;

        if (url.startsWith('/ticket') && method === 'POST' && !userPermissions.includes('ticket:create')) {
            return sendResponse(reply, 403, 'AUTH403', 'No tienes permiso');
        }
    } catch (err) {
        request.log.error({ err }, 'JWT verify failed');
        return sendResponse(reply, 401, 'AUTH401', 'Sesión inválida');
    }
};

fastify.addHook('onResponse', async (request, reply) => {
    const log = {
        method: request.method,
        url: request.url,
        status: reply.statusCode,
        user: request.user?.sub || 'guest',
        ip: request.ip,
        date: new Date()
    };
    console.log('--- LOG ---', log);
});

fastify.register(proxy, {
    upstream: 'http://localhost:3004',
    prefix: '/auth',
    rewritePrefix: '/'
});

fastify.register(proxy, {
    upstream: 'http://localhost:3001',
    prefix: '/user',
    rewritePrefix: '/'
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
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    console.log('✅ Gateway Activo - Puerto 3000');
});