# Conectar el taller a una base propia (Supabase)

Con esto cada persona entra con **Google** (o con un enlace a su correo) y sus libros quedan
en **su carpeta privada**. Es gratis hasta 1 GB de archivos y 50.000 usuarios por mes.

## 1. Crear la base (5 minutos)
1. Entrá a **supabase.com** → *Start your project* → registrate con Google.
2. *New project*: nombre `taller-editorial`, una contraseña de base (anotala), región
   **South America (São Paulo)**, plan **Free**. Esperá a que termine.
3. **SQL Editor → New query**: pegá todo el archivo `docs/supabase.sql` y tocá **Run**.

## 2. Activar la entrada con Google
1. En Supabase: **Authentication → Sign In / Providers → Google → Enable**.
2. Ahí mismo copiá la **Callback URL** que muestra (termina en `/auth/v1/callback`).
3. En **console.cloud.google.com**: *APIs y servicios → Pantalla de consentimiento de OAuth*
   (tipo **Externo**, nombre «Taller editorial»), y después *Credenciales → Crear credenciales →
   ID de cliente de OAuth → Aplicación web*. En **URI de redireccionamiento autorizados** pegá la
   Callback URL del paso 2.
4. Copiá el **ID de cliente** y el **Secreto** y pegalos en Supabase (Google provider) → *Save*.
5. En Supabase: **Authentication → URL Configuration → Site URL**: la dirección del taller
   (por ejemplo `https://taller-editorial.vercel.app`) y agregala también en *Redirect URLs*.

La entrada con **correo** (enlace mágico) funciona sin el paso 2.

## 3. Conectar el taller
Dos formas:
- **Para todos los usuarios de una publicación** (Vercel → *Settings → Environment Variables*):
  `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON` con los datos de **Project Settings → API**
  (Project URL y la clave *anon / publishable*). Para que la IA del taller ande con estos
  usuarios, agregá también `SUPABASE_URL` y `SUPABASE_ANON` con los mismos valores. Después, *Redeploy*.
- **Para una sola persona o editorial**: en la pantalla de entrada, *Conectar tu base*, pegar los dos datos.

La clave *anon / publishable* es pública por diseño: lo que protege los libros son las reglas del paso 1.
Nunca uses la clave *service_role* en el taller.
