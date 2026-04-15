const fastify = require('fastify')({ logger: true });
const { createClient } = require('@supabase/supabase-js');
const cors = require('@fastify/cors');

const supabase = createClient(
    "https://ikhaimvtmtclvdddhvtf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlraGFpbXZ0bXRjbHZkZGRodnRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ3OTIwMSwiZXhwIjoyMDkwMDU1MjAxfQ.ScDanw0Obr7mre9TwZgLNM6smHOlwmgVL73P0Dd9VFw"
);

fastify.register(cors, { origin: '*' });

async function translatePermissions(users) {
    try {
        const { data: allPerms } = await supabase.from('permisos').select('id, nombre');
        const dict = {};
        allPerms?.forEach(p => dict[p.id] = p.nombre);

        const arrayUsers = Array.isArray(users) ? users : [users];
        return arrayUsers.map(u => ({
            ...u,
            permisos_globales: (u.permisos_globales || []).map(uuid => dict[uuid] || uuid)
        }));
    } catch (e) {
        return users;
    }
}

fastify.get('/', async (request, reply) => {
    const { data, error } = await supabase.from('usuarios').select('*').order('nombre_completo');
    if (error) return reply.status(400).send(error);
    const translated = await translatePermissions(data || []);
    return { data: translated };
});

fastify.post('/', async (request, reply) => {
    const { email, password, username, nombre_completo, direccion, telefono, fecha_nacimiento } = request.body;

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, nombre_completo }
    });

    if (authError) return reply.status(400).send({ message: authError.message });

    const { data: profile, error: profileError } = await supabase.from('usuarios').insert([{
        id: authUser.user.id,
        username,
        email,
        nombre_completo,
        direccion,
        telefono,
        fecha_nacimiento,
        fecha_inicio: new Date().toISOString().split('T')[0],
        permisos_globales: []
    }]).select().single();

    if (profileError) {
        await supabase.auth.admin.deleteUser(authUser.user.id);
        return reply.status(400).send(profileError);
    }

    const [translated] = await translatePermissions(profile);
    return { data: translated };
});

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
        const [finalUser] = await translatePermissions(data);
        return { data: finalUser };
    } catch (e) {
        return reply.status(500).send(e);
    }
});

fastify.put('/:id', async (request, reply) => {
    const { id } = request.params;
    const { data, error } = await supabase.from('usuarios').update(request.body).eq('id', id).select().single();
    if (error) return reply.status(400).send(error);
    const [translated] = await translatePermissions(data);
    return { data: translated };
});

fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params;
    await supabase.auth.admin.deleteUser(id);
    const { error } = await supabase.from('usuarios').delete().eq('id', id);
    return error ? reply.status(400).send(error) : { success: true };
});

fastify.listen({ port: 3001, host: '0.0.0.0' }, (err) => {
    if (err) throw err;
    console.log("✅ User Backend en puerto 3001");
});