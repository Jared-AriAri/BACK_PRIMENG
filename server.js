const fastify = require('fastify')({ logger: true });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://ikhaimvtmtclvdddhvtf.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlraGFpbXZ0bXRjbHZkZGRodnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzkyMDEsImV4cCI6MjA5MDA1NTIwMX0.H4LUExQeLNuzpI4T9twZq7fG4XXBQOh03QjTSJOoxbw";
const supabase = createClient(supabaseUrl, supabaseKey);

fastify.register(require('@fastify/cors'), {
    origin: "*"
});

fastify.get('/tickets', async (request, reply) => {
    const { data, error } = await supabase
        .from('tickets')
        .select('*');

    if (error) {
        return reply.status(400).send(error);
    }
    return data;
});

const start = async () => {
    try {
        await fastify.listen({ port: 3000, host: '0.0.0.0' });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();