import { db } from '../db.js';
import { hashPassword, verifyPassword } from './password.js';
import { env } from '../config/env.js';

export interface CandidateIdentity {
  id: number;
  name: string;
  email: string;
  mustChangePassword: boolean;
}

export async function setCandidatePassword(candidateId: number, password: string, options: { mustChange?: boolean } = {}): Promise<void> {
  const passwordHash = await hashPassword(password);
  await db.query(`
    INSERT INTO candidate_auth(candidate_id,password_hash,must_change_password,updated_at)
    VALUES($1,$2,$3,now())
    ON CONFLICT(candidate_id) DO UPDATE SET
      password_hash=EXCLUDED.password_hash,
      must_change_password=EXCLUDED.must_change_password,
      updated_at=now()
  `, [candidateId,passwordHash,options.mustChange ?? false]);
}


export async function ensureCandidateDefaultPassword(candidateId: number, password = env.defaultCandidatePassword): Promise<void> {
  const existing = await db.query<{ password_hash:string|null }>('SELECT password_hash FROM candidate_auth WHERE candidate_id=$1', [candidateId]);
  if (existing.rows[0]?.password_hash) return;
  await setCandidatePassword(candidateId, password, { mustChange:true });
}

export async function authenticateCandidate(email: string, password: string): Promise<CandidateIdentity | null> {
  const result = await db.query<{
    id: string | number; name: string; email: string; password_hash: string | null; must_change_password: boolean | null;
  }>(`
    SELECT c.id,c.name,c.email,a.password_hash,a.must_change_password
    FROM candidates c LEFT JOIN candidate_auth a ON a.candidate_id=c.id
    WHERE lower(c.email)=lower($1) AND c.active=true
    LIMIT 1
  `, [email.trim()]);
  const row = result.rows[0];
  if (!row?.password_hash) return null;
  if (!await verifyPassword(password,row.password_hash)) return null;
  return { id:Number(row.id), name:row.name, email:row.email, mustChangePassword:Boolean(row.must_change_password) };
}

export async function getCandidateById(candidateId: number): Promise<CandidateIdentity | null> {
  const result = await db.query<{id:string|number;name:string;email:string;must_change_password:boolean|null}>(`
    SELECT c.id,c.name,c.email,a.must_change_password
    FROM candidates c LEFT JOIN candidate_auth a ON a.candidate_id=c.id
    WHERE c.id=$1 AND c.active=true
  `,[candidateId]);
  const row=result.rows[0];
  return row ? { id:Number(row.id), name:row.name, email:row.email, mustChangePassword:Boolean(row.must_change_password) } : null;
}

export async function findOrBindGoogleCandidate(input: { email: string; sub: string }): Promise<CandidateIdentity | null> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const bound = await client.query<{ id:string|number; name:string; email:string; must_change_password:boolean|null }>(`
      SELECT c.id,c.name,c.email,a.must_change_password
      FROM candidate_auth a JOIN candidates c ON c.id=a.candidate_id
      WHERE a.google_sub=$1 AND c.active=true
      LIMIT 1
    `,[input.sub]);
    if(bound.rows[0]){
      await client.query('COMMIT');
      const row=bound.rows[0];
      return { id:Number(row.id), name:row.name, email:row.email, mustChangePassword:Boolean(row.must_change_password) };
    }

    const candidate = await client.query<{ id:string|number; name:string; email:string; google_sub:string|null; must_change_password:boolean|null }>(`
      SELECT c.id,c.name,c.email,a.google_sub,a.must_change_password
      FROM candidates c LEFT JOIN candidate_auth a ON a.candidate_id=c.id
      WHERE lower(c.email)=lower($1) AND c.active=true
      LIMIT 1 FOR UPDATE OF c
    `,[input.email]);
    const row=candidate.rows[0];
    if(!row || (row.google_sub && row.google_sub!==input.sub)){
      await client.query('ROLLBACK');
      return null;
    }
    await client.query(`
      INSERT INTO candidate_auth(candidate_id,google_sub,google_email,updated_at)
      VALUES($1,$2,$3,now())
      ON CONFLICT(candidate_id) DO UPDATE SET
        google_sub=EXCLUDED.google_sub,
        google_email=EXCLUDED.google_email,
        updated_at=now()
    `,[row.id,input.sub,input.email.toLowerCase()]);
    await client.query('COMMIT');
    return { id:Number(row.id), name:row.name, email:row.email, mustChangePassword:Boolean(row.must_change_password) };
  }catch(error){
    await client.query('ROLLBACK');
    throw error;
  }finally{
    client.release();
  }
}
