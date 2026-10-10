import {DatabaseSync} from 'node:sqlite';
import pg from 'pg';
import {mkdirSync} from 'node:fs';
const schema=[
`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password TEXT NOT NULL,created BIGINT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires BIGINT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS organizations(id TEXT PRIMARY KEY,name TEXT NOT NULL,created BIGINT NOT NULL,customer_id TEXT UNIQUE,subscription_id TEXT UNIQUE,subscription_status TEXT NOT NULL DEFAULT 'none',plan TEXT NOT NULL DEFAULT 'starter',period_end BIGINT NOT NULL DEFAULT 0,cancel_at_end INTEGER NOT NULL DEFAULT 0,checkout_id TEXT,checkout_plan TEXT,checkout_expires BIGINT NOT NULL DEFAULT 0,billing_updated BIGINT NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS memberships(organization_id TEXT NOT NULL REFERENCES organizations(id),user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL CHECK(role IN ('owner','admin','member')),joined BIGINT NOT NULL,PRIMARY KEY(organization_id,user_id))`,
`CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organizations(id),name TEXT NOT NULL,description TEXT NOT NULL,status TEXT NOT NULL,created BIGINT NOT NULL)`,
`CREATE INDEX IF NOT EXISTS projects_org ON projects(organization_id)`,
`CREATE TABLE IF NOT EXISTS invites(token TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organizations(id),email TEXT NOT NULL,role TEXT NOT NULL,expires BIGINT NOT NULL,used_by TEXT)`,
`CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organizations(id),actor TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL,created BIGINT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS stripe_events(id TEXT PRIMARY KEY,type TEXT NOT NULL,processed BIGINT NOT NULL)`];
export async function createStore(url=process.env.DATABASE_URL,path='data/tenantflow.db'){
 let db,pool,queue=Promise.resolve();
 const enqueue=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result};
 if(url)pool=new pg.Pool({connectionString:url,max:10});else{mkdirSync('data',{recursive:true});db=new DatabaseSync(path);db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000')}
 const queryOn=async(conn,q,p=[])=>{if(pool){let n=0;return (await conn.query(q.replace(/\?/g,()=>'$'+(++n)),p)).rows}const statement=db.prepare(q);return /^\s*SELECT/i.test(q)?statement.all(...p):(statement.run(...p),[])};
 const access=conn=>({query:(q,p)=>queryOn(conn,q,p),one:async(q,p)=>(await queryOn(conn,q,p))[0]});
 const query=(q,p=[])=>pool?queryOn(pool,q,p):enqueue(()=>queryOn(null,q,p));
 const one=async(q,p)=>(await query(q,p))[0];
 const transaction=async(lock,fn)=>{
 if(pool){const c=await pool.connect();try{await c.query('BEGIN');if(lock)await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[lock]);const result=await fn(access(c));await c.query('COMMIT');return result}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}
 return enqueue(async()=>{db.exec('BEGIN IMMEDIATE');try{const result=await fn(access(null));db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}});
 };
 for(const q of schema)await query(q);
 return {query,one,transaction,close:async()=>{await queue;if(pool)await pool.end();else db.close()}};
}
