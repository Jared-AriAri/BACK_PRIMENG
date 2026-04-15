const fastify = require('fastify')({ logger: true });
const { createClient } = require('@supabase/supabase-js');
const cors = require('@fastify/cors');

const supabase = createClient(
    "https://ikhaimvtmtclvdddhvtf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlraGFpbXZ0bXRjbHZkZGRodnRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ3OTIwMSwiZXhwIjoyMDkwMDU1MjAxfQ.ScDanw0Obr7mre9TwZgLNM6smHOlwmgVL73P0Dd9VFw"
);

fastify.register(cors, { origin: "*" });

fastify.get('/mine/:userId', async (request, reply) => {
    const { userId } = request.params;
    const { data, error } = await supabase
        .from('grupo_miembros')
        .select('grupos(*)')
        .eq('usuario_id', userId);

    if (error) {
        console.error("Supabase Error:", error);
        return reply.status(400).send({ error: error.message });
    }
    const groups = data.map(item => item.grupos).filter(g => !!g);
    return { data: groups };
});

fastify.get('/', async (request, reply) => {
    const { data, error } = await supabase.from('grupos').select('*').order('creado_en', { ascending: false });
    return error ? reply.status(400).send(error) : { data };
});

fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;
    const { data, error } = await supabase.from('grupos').select('*').eq('id', id).single();
    return error ? reply.status(404).send(error) : { data };
});

fastify.post('/', async (request, reply) => {
    const { data, error } = await supabase.from('grupos').insert([request.body]).select().single();
    return error ? reply.status(400).send(error) : { data };
});

fastify.put('/:id', async (request, reply) => {
    const { id } = request.params;
    const { data, error } = await supabase.from('grupos').update(request.body).eq('id', id).select().single();
    return error ? reply.status(400).send(error) : { data };
});

fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params;
    const { error } = await supabase.from('grupos').delete().eq('id', id);
    return error ? reply.status(400).send(error) : { success: true };
});

fastify.get('/:id/members', async (request, reply) => {
    const { id } = request.params;
    const { data, error } = await supabase
        .from("grupo_miembros")
        .select(`usuario_id, fecha_unido, usuarios (id, nombre_completo, email, username)`)
        .eq("grupo_id", id);
    if (error) return reply.status(400).send(error);
    const members = data.map(m => ({
        usuario_id: m.usuario_id,
        fecha_unido: m.fecha_unido,
        nombre_completo: m.usuarios?.nombre_completo,
        email: m.usuarios?.email,
        username: m.usuarios?.username
    }));
    return { data: members };
});

fastify.post('/:id/members', async (request, reply) => {
    const { id } = request.params;
    const { usuarioId } = request.body;
    const { data, error } = await supabase
        .from("grupo_miembros")
        .insert([{ grupo_id: id, usuario_id: usuarioId }])
        .select();
    return error ? reply.status(400).send(error) : { data: data[0] };
});

fastify.delete('/:id/members/:usuarioId', async (request, reply) => {
    const { id, usuarioId } = request.params;
    const { error } = await supabase
        .from("grupo_miembros")
        .delete()
        .match({ grupo_id: id, usuario_id: usuarioId });
    return error ? reply.status(400).send(error) : { success: true };
});

fastify.listen({ port: 3003, host: '0.0.0.0' });