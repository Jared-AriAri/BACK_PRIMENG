const fastify = require('fastify')({ logger: true, ignoreTrailingSlash: true });
const { createClient } = require('@supabase/supabase-js');
const cors = require('@fastify/cors');

const supabase = createClient(
    "https://ikhaimvtmtclvdddhvtf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlraGFpbXZ0bXRjbHZkZGRodnRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ3OTIwMSwiZXhwIjoyMDkwMDU1MjAxfQ.ScDanw0Obr7mre9TwZgLNM6smHOlwmgVL73P0Dd9VFw"
);

fastify.register(cors, { origin: "*" });

const TICKET_QUERY = `
  *,
  estados (id, nombre, color),
  prioridades (id, nombre, orden),
  usuarios:usuarios!tickets_asignado_id_fkey (id, nombre_completo, username)
`;

fastify.get('/ticket', async (request, reply) => {
    const { grupo_id, estado_id } = request.query;
    let query = supabase.from('tickets').select(TICKET_QUERY);
    if (grupo_id) query = query.eq('grupo_id', grupo_id);
    if (estado_id) query = query.eq('estado_id', estado_id);
    const { data, error } = await query.order('creado_en', { ascending: false });
    if (error) return reply.status(400).send({ error: error.message });
    return { data: data || [] };
});

fastify.get('/ticket/states', async (request, reply) => {
    const { data, error } = await supabase.from('estados').select('id, nombre, color');
    if (error) return reply.status(400).send({ error: error.message });
    return { data };
});

fastify.get('/ticket/priorities', async (request, reply) => {
    const { data, error } = await supabase.from('prioridades').select('id, nombre').order('orden');
    if (error) return reply.status(400).send({ error: error.message });
    return { data };
});

fastify.get('/ticket/:id', async (request, reply) => {
    const { id } = request.params;
    const { data, error } = await supabase.from('tickets').select(TICKET_QUERY).eq('id', id).single();
    if (error) return reply.status(404).send({ error: 'Ticket no encontrado' });
    return { data };
});

fastify.post('/ticket', async (request, reply) => {
    const { data, error } = await supabase.from('tickets').insert([request.body]).select(TICKET_QUERY).single();
    if (error) return reply.status(400).send({ error: error.message });
    return { data };
});

fastify.put('/ticket/:id', async (request, reply) => {
    const { id } = request.params;
    const { data, error } = await supabase.from('tickets').update(request.body).eq('id', id).select(TICKET_QUERY).single();
    if (error) return reply.status(400).send({ error: error.message });
    return { data };
});

fastify.delete('/ticket/:id', async (request, reply) => {
    const { id } = request.params;
    const { error } = await supabase.from('tickets').delete().eq('id', id);
    if (error) return reply.status(400).send({ error: error.message });
    return { success: true };
});

fastify.get('/ticket/:id/comments', async (request, reply) => {
    const { data, error } = await supabase
        .from('comentarios')
        .select('*, usuarios:usuarios!comentarios_autor_id_fkey(id, nombre_completo, username)')
        .eq('ticket_id', request.params.id)
        .order('creado_en', { ascending: true });
    if (error) return reply.status(400).send({ error: error.message });
    const formatted = data.map(c => ({
        ...c,
        nombre_completo: c.usuarios?.nombre_completo,
        username: c.usuarios?.username
    }));
    return { data: formatted };
});

fastify.post('/ticket/comments', async (request, reply) => {
    const { data, error } = await supabase
        .from('comentarios')
        .insert([request.body])
        .select('*, usuarios:usuarios!comentarios_autor_id_fkey(id, nombre_completo, username)')
        .single();
    if (error) return reply.status(400).send({ error: error.message });
    return { data };
});

fastify.listen({ port: 3002, host: '0.0.0.0' });