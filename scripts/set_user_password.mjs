import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const auth = getAuth()

async function main() {
  const email = 'garrido.rui@gmail.com'
  const newPassword = '123456' // Password temporária/de teste

  try {
    const user = await auth.getUserByEmail(email)
    await auth.updateUser(user.uid, { password: newPassword })
    console.log(`✓ Password do utilizador ${email} atualizada com sucesso para: ${newPassword}`)
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const user = await auth.createUser({
        email,
        password: newPassword,
        displayName: 'RG (UR)',
      })
      console.log(`✓ Utilizador criado no Firebase Auth (${email}) com a password: ${newPassword}`)
    } else {
      console.error('Erro:', err)
    }
  }
}

main().catch(console.error)
