const fastify = require('fastify')({ logger: true });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    "https://ikhaimvtmtclvdddhvtf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlraGFpbXZ0bXRjbHZkZGRodnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzkyMDEsImV4cCI6MjA5MDA1NTIwMX0.H4LUExQeLNuzpI4T9twZq7fG4XXBQOh03QjTSJOoxbw"
);

fastify.post('/login', async (request, reply) => {
    try {
        const { email, password } = request.body;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            return reply.status(401).send({ message: error.message });
        }

        return {
            user: data.user,
            token: data.session.access_token
        };
    } catch (err) {
        return reply.status(500).send({ message: "Error interno en el servidor de auth" });
    }
});

fastify.post('/register', async (request, reply) => {
    try {
        const { username, email, fullName, address, phone, birthDate, password } = request.body;

        const { data: existing } = await supabase
            .from("usuarios")
            .select("username, email")
            .or(`username.eq.${username},email.eq.${email}`);

        if (existing && existing.length > 0) {
            return reply.status(400).send({ message: "El usuario o email ya existe" });
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { username, full_name: fullName } }
        });

        if (signUpError) return reply.status(400).send(signUpError);

        const { data: perms } = await supabase
            .from("permisos")
            .select("id")
            .in("nombre", ["group:view", "ticket:view", "ticket:create", "ticket:comment"]);

        const permsIds = perms?.map(p => p.id) || [];

        const { error: dbError } = await supabase.from("usuarios").insert({
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

        if (dbError) return reply.status(400).send(dbError);

        return { success: true };
    } catch (err) {
        return reply.status(500).send({ message: "Error en el registro" });
    }
});

fastify.get('/me', async (request, reply) => {
    try {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) return reply.status(401).send({ error: 'No token provided' });

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return reply.status(401).send({ error: 'Unauthorized' });

        const { data: db, error: dbError } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', user.email.toLowerCase())
            .single();

        if (dbError || !db) return reply.status(404).send({ error: 'User data not found' });

        let permissionNames = [];
        if (db.permisos_globales?.length > 0) {
            const { data: permsData } = await supabase
                .from('permisos')
                .select('nombre')
                .in('id', db.permisos_globales);
            permissionNames = permsData?.map(p => p.nombre) || [];
        }

        return {
            id: db.id,
            username: db.username,
            email: db.email,
            fullName: db.nombre_completo,
            address: db.direccion,
            phone: db.telefono,
            birthDate: db.fecha_nacimiento,
            creado_en: db.creado_en,
            permissions: permissionNames
        };
    } catch (err) {
        return reply.status(500).send({ error: "Error obteniendo perfil" });
    }
});

fastify.post('/logout', async (request, reply) => {
    return { success: true };
});

fastify.listen({ port: 3004, host: '0.0.0.0' }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log("✅ Auth Service listo en puerto 3004");
});