const fastify = require('fastify')({ logger: true });
const { createClient } = require('@supabase/supabase-js');
const cors = require('@fastify/cors');

const supabase = createClient(
    "https://ikhaimvtmtclvdddhvtf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlraGFpbXZ0bXRjbHZkZGRodnRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ3OTIwMSwiZXhwIjoyMDkwMDU1MjAxfQ.ScDanw0Obr7mre9TwZgLNM6smHOlwmgVL73P0Dd9VFw"
);

fastify.register(cors, { origin: "*" });

// --- AUTENTICACIÓN ---

fastify.post('/login', async (request, reply) => {
    try {
        const { email, password } = request.body;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return reply.status(401).send({ message: error.message });
        return { user: data.user, token: data.session.access_token };
    } catch (err) {
        return reply.status(500).send({ message: "Error interno en el servidor" });
    }
});

fastify.post('/register', async (request, reply) => {
    try {
        const { username, email, fullName, address, phone, birthDate, password } = request.body;
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { username, full_name: fullName } }
        });
        if (signUpError) return reply.status(400).send(signUpError);

        const { data: perms } = await supabase.from("permisos").select("id").in("nombre", ["group:view", "ticket:view", "ticket:create"]);
        const permsIds = perms?.map(p => p.id) || [];

        await supabase.from("usuarios").insert({
            id: signUpData.user.id,
            username,
            email,
            nombre_completo: fullName,
            direccion: address,
            telefono: phone,
            fecha_nacimiento: birthDate,
            permisos_globales: permsIds,
            fecha_inicio: new Date().toISOString().split('T')[0]
        });
        return { success: true };
    } catch (err) {
        return reply.status(500).send({ message: "Error en el registro" });
    }
});

// --- PERFIL DE USUARIO (USADO POR DASHBOARD) ---

fastify.get('/me', async (request, reply) => {
    try {
        const authHeader = request.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        if (!token) return reply.status(401).send({ error: 'No token' });

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return reply.status(401).send({ error: 'Unauthorized' });

        const { data: dbUser } = await supabase.from('usuarios').select('*').eq('id', user.id).single();
        if (!dbUser) return reply.status(404).send({ error: 'User not found' });

        // Obtener nombres de permisos (Traducción UUID -> Nombre)
        const { data: pData } = await supabase
            .from('permisos')
            .select('nombre')
            .in('id', dbUser.permisos_globales || []);

        // Obtener grupos a los que pertenece
        const { data: membresias } = await supabase
            .from('grupo_miembros')
            .select('grupo_id, grupos(nombre)')
            .eq('usuario_id', user.id);

        return {
            id: dbUser.id,
            username: dbUser.username,
            email: dbUser.email,
            fullName: dbUser.nombre_completo,
            direccion: dbUser.direccion,
            telefono: dbUser.telefono,
            permissions: pData?.map(p => p.nombre) || [],
            groups: membresias?.map(m => ({ id: m.grupo_id, nombre: m.grupos?.nombre })) || []
        };
    } catch (err) {
        return reply.status(500).send({ error: "Internal Error" });
    }
});

// --- ADMINISTRACIÓN DE USUARIOS (CRUD) ---

fastify.get('/users', async (request, reply) => {
    const { data, error } = await supabase.from('usuarios').select('*').order('creado_en', { ascending: false });
    if (error) return reply.status(400).send(error);
    return { data };
});

fastify.post('/users', async (request, reply) => {
    try {
        const { email, password, username, nombre_completo, direccion, telefono, fecha_nacimiento } = request.body;

        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email, password, email_confirm: true, user_metadata: { username, nombre_completo }
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
            return reply.status(400).send({ message: profileError.message });
        }
        return { data: profile };
    } catch (err) {
        return reply.status(500).send({ message: "Error al crear usuario administrativo" });
    }
});

fastify.put('/users/:id', async (request, reply) => {
    const { id } = request.params;
    const { data, error } = await supabase.from('usuarios').update(request.body).eq('id', id).select().single();
    if (error) return reply.status(400).send(error);
    return { data };
});

fastify.put('/users/:id/permissions', async (request, reply) => {
    const { id } = request.params;
    const { permisos } = request.body;
    const { data, error } = await supabase.from('usuarios').update({ permisos_globales: permisos }).eq('id', id).select().single();
    if (error) return reply.status(400).send(error);
    return { data };
});

fastify.delete('/users/:id', async (request, reply) => {
    const { id } = request.params;
    const { error: authError } = await supabase.auth.admin.deleteUser(id);
    const { error: dbError } = await supabase.from('usuarios').delete().eq('id', id);
    if (authError || dbError) return reply.status(400).send({ authError, dbError });
    return { success: true };
});

fastify.listen({ port: 3004, host: '0.0.0.0' }, (err) => {
    if (err) { console.error(err); process.exit(1); }
    console.log("✅ Auth & User Service listo en puerto 3004");
});