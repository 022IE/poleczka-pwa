import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import nacl from 'tweetnacl'

const token = process.env.CLOUDFLARE_API_TOKEN
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const databaseId = process.env.D1_DATABASE_ID
const databaseName = process.env.D1_DATABASE_NAME || 'poleczka-dev'
const requestPath = process.env.D1_BRIDGE_REQUEST || ''
const outputDir = process.env.D1_BRIDGE_OUTPUT_DIR || 'd1-bridge-output'

if (!token || !accountId || !databaseId) {
  throw new Error('Missing CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID or D1_DATABASE_ID')
}

fs.mkdirSync(outputDir, { recursive: true })

const toB64 = (value) => Buffer.from(value).toString('base64')
const fromB64 = (value) => new Uint8Array(Buffer.from(value, 'base64'))

// Klucz prywatny mostu jest deterministycznie wyprowadzany z API tokenu i nigdy
// nie jest zapisywany w repozytorium ani w logach. Publiczny klucz może być jawny.
const bridgeSecret = new Uint8Array(
  crypto.createHash('sha256').update('poleczka-d1-bridge-v1\0').update(token).digest(),
)
const bridgeKeys = nacl.box.keyPair.fromSecretKey(bridgeSecret)
const bridgePublicKey = toB64(bridgeKeys.publicKey)

fs.writeFileSync(
  path.join(outputDir, 'public-key.json'),
  JSON.stringify({ version: 1, algorithm: 'curve25519-xsalsa20-poly1305', publicKey: bridgePublicKey }, null, 2) + '\n',
)

async function d1Query(sql, params = []) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    },
  )

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload || payload.success === false) {
    const safeError = payload?.errors?.map((item) => item?.message).filter(Boolean).join('; ') || `HTTP ${response.status}`
    throw new Error(`Cloudflare D1 query failed: ${safeError}`)
  }
  return payload
}

async function writeSchemaSnapshot() {
  const sql = `
    SELECT type, name, tbl_name, sql
    FROM sqlite_master
    WHERE type IN ('table', 'index', 'trigger', 'view')
      AND name NOT LIKE 'sqlite_%'
    ORDER BY type, name
  `
  const result = await d1Query(sql)
  fs.writeFileSync(
    path.join(outputDir, 'schema.json'),
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      databaseName,
      databaseId,
      result,
    }, null, 2) + '\n',
  )
}

function decryptRequest(envelope) {
  if (envelope?.version !== 1) throw new Error('Unsupported bridge request version')
  const senderPublicKey = fromB64(envelope.ephemeralPublicKey)
  const nonce = fromB64(envelope.nonce)
  const cipher = fromB64(envelope.ciphertext)
  if (senderPublicKey.length !== nacl.box.publicKeyLength) throw new Error('Invalid sender public key')
  if (nonce.length !== nacl.box.nonceLength) throw new Error('Invalid request nonce')

  const plain = nacl.box.open(cipher, nonce, senderPublicKey, bridgeKeys.secretKey)
  if (!plain) throw new Error('Unable to decrypt D1 bridge request')
  return JSON.parse(Buffer.from(plain).toString('utf8'))
}

function encryptResponse(requestId, responsePublicKeyB64, value) {
  const responsePublicKey = fromB64(responsePublicKeyB64)
  if (responsePublicKey.length !== nacl.box.publicKeyLength) throw new Error('Invalid response public key')

  const nonce = nacl.randomBytes(nacl.box.nonceLength)
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8')
  const cipher = nacl.box(
    new Uint8Array(plaintext),
    nonce,
    responsePublicKey,
    bridgeKeys.secretKey,
  )

  return {
    version: 1,
    requestId,
    bridgePublicKey,
    nonce: toB64(nonce),
    ciphertext: toB64(cipher),
  }
}

async function processEncryptedRequest(file) {
  const envelope = JSON.parse(fs.readFileSync(file, 'utf8'))
  const request = decryptRequest(envelope)
  const requestId = String(request.requestId || '').trim()
  const sql = String(request.sql || '')
  const params = Array.isArray(request.params) ? request.params : []
  const responsePublicKey = String(request.responsePublicKey || '')

  if (!/^[A-Za-z0-9._-]{1,100}$/.test(requestId)) throw new Error('Invalid requestId')
  if (!sql.trim()) throw new Error('Empty SQL request')
  if (Buffer.byteLength(sql, 'utf8') > 500_000) throw new Error('SQL request too large')

  let response
  try {
    const result = await d1Query(sql, params)
    response = { ok: true, requestId, executedAt: new Date().toISOString(), result }
  } catch (error) {
    response = {
      ok: false,
      requestId,
      executedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'D1 bridge request failed',
    }
  }

  const encrypted = encryptResponse(requestId, responsePublicKey, response)
  fs.writeFileSync(
    path.join(outputDir, `response-${requestId}.json`),
    JSON.stringify(encrypted, null, 2) + '\n',
  )
}

await writeSchemaSnapshot()

if (requestPath && fs.existsSync(requestPath)) {
  await processEncryptedRequest(requestPath)
}

console.log(`D1 bridge ready for ${databaseName}. Sensitive query results are encrypted.`)
