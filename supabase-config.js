// Datos del proyecto de Supabase.
//
// La clave "anon" está pensada para vivir en el navegador: no es un secreto.
// Lo que protege los recuerdos son las reglas de acceso (RLS) de la tabla y
// del bucket, no esconder esta clave.
//
// Los dos valores salen del panel de Supabase, en Project Settings > API.
const SUPABASE_CONFIG = {
    url: 'https://njdbaeuwdxifwljnnulh.supabase.co',
    anonKey: 'sb_publishable_i2BkZ0vf3AAP0Y9n7NLAXQ_lhL1cL7a',
    tabla: 'recuerdos',
    bucket: 'fotos'
};
