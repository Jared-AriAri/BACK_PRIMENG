const fastify = require('fastify')({ logger: true });
const { createClient } = require('@supabase/supabase-js');
const cors = require('@fastify/cors');

const supabase = createClient(
    "https://ikhaimvtmtclvdddhvtf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlraGFpbXZ0bXRjbHZkZGRodnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzkyMDEsImV4cCI6MjA5MDA1NTIwMX0.H4LUExQeLNuzpI4T9twZq7fG4XXBQOh03QjTSJOoxbw"
);

fastify.register(cors, { origin: '*' });

async function translatePermissions(users) {
    try {
        const { data: allPerms } = await supabase.from('permisos').select('id, nombre');
        const dict = {};
        allPerms?.forEach(p => dict[p.id] = p.nombre);
        return users.map(u => ({
            ...u,
            permisos_globales: (u.permisos_globales || []).map(uuid => dict[uuid] || uuid)
        }));
    } catch (e) {
        return users;
    }
}

fastify.get('/', async (request, reply) => {
    const { data, error } = await supabase.from('usuarios').select('*');
    if (error) return reply.status(400).send(error);
    const translated = await translatePermissions(data || []);
    return { data: translated };
});

// ESTA ES LA RUTA QUE TE DABA 404
fastify.put('/:id/permissions', async (request, reply) => {
    const { id } = request.params;
    const { permissions } = request.body;
    try {
        const { data: dbPerms } = await supabase.from('permisos').select('id').in('nombre', permissions);
        const permsIds = dbPerms?.map(p => p.id) || [];

        const { data, error } = await supabase
            .from('usuarios')
            .update({ permisos_globales: permsIds })
            .eq('id', id)
            .select()
            .single();

        if (error) return reply.status(400).send(error);
        const [finalUser] = await translatePermissions([data]);
        return { data: finalUser };
    } catch (e) {
        return reply.status(500).send(e);
    }
});

fastify.put('/:id', async (request, reply) => {
    const { id } = request.params;
    const { data, error } = await supabase.from('usuarios').update(request.body).eq('id', id).select().single();
    if (error) return reply.status(400).send(error);
    const [translated] = await translatePermissions([data]);
    return { data: translated };
});

fastify.listen({ port: 3001, host: '0.0.0.0' });