import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrado no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Cria ou busca usuário de teste
const email = 'test@pixlland.local';
const password = 'testpassword123';

console.log('\n🔑 Gerando token de acesso...\n');

// Tenta fazer login primeiro
const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
  email,
  password
});

if (signInData?.session?.access_token) {
  console.log('✅ Login realizado com sucesso!\n');
  console.log('Cole esta URL no navegador:\n');
  console.log(`http://localhost:3487/editor/project/1?access_token=${signInData.session.access_token}\n`);
  console.log('Ou copie apenas o token:\n');
  console.log(signInData.session.access_token);
  console.log('\n');
  process.exit(0);
}

// Se falhou, tenta criar usuário
console.log('ℹ️  Usuário não existe, criando...\n');

const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true
});

if (signUpError) {
  console.error('❌ Erro ao criar usuário:', signUpError);
  process.exit(1);
}

// Faz login com o novo usuário
const { data: newSignInData, error: newSignInError } = await supabase.auth.signInWithPassword({
  email,
  password
});

if (newSignInError || !newSignInData?.session?.access_token) {
  console.error('❌ Erro ao fazer login:', newSignInError);
  process.exit(1);
}

console.log('✅ Usuário criado e autenticado com sucesso!\n');
console.log('Cole esta URL no navegador:\n');
console.log(`http://localhost:3487/editor/project/1?access_token=${newSignInData.session.access_token}\n`);
console.log('Ou copie apenas o token:\n');
console.log(newSignInData.session.access_token);
console.log('\n');

