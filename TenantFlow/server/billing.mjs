import Stripe from 'stripe';
import {randomUUID} from 'node:crypto';
import {fail} from './security.mjs';
export const limits={starter:{projects:3,seats:3},pro:{projects:50,seats:15},business:{projects:1000,seats:50}};
export const effectivePlan=org=>['active','trialing'].includes(org.subscription_status)&&['pro','business'].includes(org.plan)?org.plan:'starter';
export function createBilling({store,origin,secretKey=process.env.STRIPE_SECRET_KEY,webhookSecret=process.env.STRIPE_WEBHOOK_SECRET,prices={pro:process.env.STRIPE_PRICE_PRO,business:process.env.STRIPE_PRICE_BUSINESS},stripe:injected}={}){
 if(secretKey?.startsWith('sk_live_')&&process.env.STRIPE_ALLOW_LIVE!=='true')throw Error('Live Stripe keys are disabled. Use a sandbox key or explicitly enable live mode.');
 const stripe=injected||(secretKey?new Stripe(secretKey,{maxNetworkRetries:2}):null);
 const configured=!!(stripe&&webhookSecret&&prices.pro&&prices.business);
 const requireReady=()=>{if(!configured)fail(503,'Stripe billing is not configured yet. Follow docs/STRIPE-SETUP.md.');};
 const audit=async(tx,org,action,detail)=>tx.query('INSERT INTO audit(id,organization_id,actor,action,detail,created) VALUES(?,?,?,?,?,?)',[randomUUID(),org,'Stripe',action,detail,Date.now()]);
 const refresh=async(tx,org,subscription)=>{
 // Retrieve canonical current Stripe state. Never grant access from redirect query parameters.
 const current=await stripe.subscriptions.retrieve(subscription);const customer=typeof current.customer==='string'?current.customer:current.customer.id;
 if(customer!==org.customer_id)fail(400,'Subscription customer does not match this organization.');
 const price=current.items?.data?.[0]?.price?.id;const plan=Object.entries(prices).find(([key,value])=>value===price)?.[0]||'starter';
 const end=current.items?.data?.[0]?.current_period_end??current.current_period_end??0;
 await tx.query('UPDATE organizations SET subscription_id=?,subscription_status=?,plan=?,period_end=?,cancel_at_end=?,billing_updated=? WHERE id=?',[current.id,current.status,plan,end,current.cancel_at_period_end?1:0,Date.now(),org.id]);
 };
 async function checkout(oid,uid,plan){requireReady();if(!prices[plan]||!['pro','business'].includes(plan))fail(400,'Choose a configured plan.');return store.transaction('org:'+oid,async tx=>{
 const member=await tx.one('SELECT role FROM memberships WHERE organization_id=? AND user_id=?',[oid,uid]);if(member?.role!=='owner')fail(403,'Only the organization owner can manage billing.');
 let org=await tx.one('SELECT * FROM organizations WHERE id=?',[oid]);
 if(!org.customer_id){const user=await tx.one('SELECT email FROM users WHERE id=?',[uid]);const customer=await stripe.customers.create({email:user.email,name:org.name,metadata:{organization_id:oid}},{idempotencyKey:'tenantflow-customer-'+oid});await tx.query('UPDATE organizations SET customer_id=? WHERE id=?',[customer.id,oid]);org={...org,customer_id:customer.id}}
 const existing=await stripe.subscriptions.list({customer:org.customer_id,status:'all',limit:100});
 if(existing.has_more)fail(409,'Subscription history requires a billing review.');
 const blocking=existing.data.find(s=>!['canceled','incomplete_expired'].includes(s.status));if(blocking){await refresh(tx,org,blocking.id);fail(409,'A subscription already exists. Use Manage billing to change or cancel it.');}
 if(org.checkout_id&&Number(org.checkout_expires)>Date.now()/1000){const previous=await stripe.checkout.sessions.retrieve(org.checkout_id);if(previous.status==='open'){if(org.checkout_plan===plan)return {url:previous.url};await stripe.checkout.sessions.expire(previous.id)}}
 const requestId=oid+'-'+plan+'-'+(org.checkout_id||'first');const session=await stripe.checkout.sessions.create({mode:'subscription',customer:org.customer_id,line_items:[{price:prices[plan],quantity:1}],client_reference_id:oid,metadata:{organization_id:oid},subscription_data:{metadata:{organization_id:oid}},success_url:origin+'/?billing=success&organization='+oid,cancel_url:origin+'/?billing=cancelled&organization='+oid},{idempotencyKey:'tenantflow-checkout-'+requestId});
 await tx.query('UPDATE organizations SET checkout_id=?,checkout_plan=?,checkout_expires=? WHERE id=?',[session.id,plan,session.expires_at,oid]);await audit(tx,oid,'checkout.started','Checkout session created for '+plan);return {url:session.url};
 })}
 async function portal(oid,uid){requireReady();return store.transaction('org:'+oid,async tx=>{const role=await tx.one('SELECT role FROM memberships WHERE organization_id=? AND user_id=?',[oid,uid]);if(role?.role!=='owner')fail(403,'Only the owner can open the billing portal.');const org=await tx.one('SELECT * FROM organizations WHERE id=?',[oid]);if(!org.customer_id)fail(400,'Create a subscription before opening the billing portal.');const session=await stripe.billingPortal.sessions.create({customer:org.customer_id,return_url:origin+'/?organization='+oid});return {url:session.url}})}
 async function webhook(raw,signature){requireReady();let event;try{event=stripe.webhooks.constructEvent(raw,signature,webhookSecret)}catch{fail(400,'Invalid Stripe signature.');}
 const supported=['checkout.session.completed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed'];if(!supported.includes(event.type))return {received:true,ignored:true};
 const object=event.data.object;const customer=typeof object.customer==='string'?object.customer:object.customer?.id;if(!customer)return {received:true,ignored:true};
 const org=await store.one('SELECT * FROM organizations WHERE customer_id=?',[customer]);if(!org)return {received:true,ignored:true};
 return store.transaction('org:'+org.id,async tx=>{if(await tx.one('SELECT id FROM stripe_events WHERE id=?',[event.id]))return {received:true,duplicate:true};
 const fresh=await tx.one('SELECT * FROM organizations WHERE id=?',[org.id]);
 const related=object.subscription||object.parent?.subscription_details?.subscription;const subscription=event.type.startsWith('customer.subscription.')?object.id:typeof related==='string'?related:related?.id;
 if(subscription){
 // Avoid an old canceled subscription overriding a newer, active one.
 if(fresh.subscription_id&&fresh.subscription_id!==subscription){const stored=await stripe.subscriptions.retrieve(fresh.subscription_id);if(!['canceled','incomplete_expired'].includes(stored.status)){await tx.query('INSERT INTO stripe_events(id,type,processed) VALUES(?,?,?)',[event.id,event.type,Date.now()]);return {received:true,ignored:true}}}
 await refresh(tx,fresh,subscription);await audit(tx,org.id,'billing.updated',event.type);
 }
 await tx.query('INSERT INTO stripe_events(id,type,processed) VALUES(?,?,?)',[event.id,event.type,Date.now()]);return {received:true};
 });}
 async function reconcile(oid,uid){requireReady();return store.transaction('org:'+oid,async tx=>{const m=await tx.one('SELECT role FROM memberships WHERE organization_id=? AND user_id=?',[oid,uid]);if(m?.role!=='owner')fail(403,'Only the owner can refresh billing.');const org=await tx.one('SELECT * FROM organizations WHERE id=?',[oid]);if(!org.customer_id)return {ok:true};const list=await stripe.subscriptions.list({customer:org.customer_id,status:'all',limit:100});if(list.has_more)fail(409,'Subscription history requires a review.');const candidate=list.data.find(s=>!['canceled','incomplete_expired'].includes(s.status))||list.data.find(s=>s.id===org.subscription_id);if(candidate)await refresh(tx,org,candidate.id);return {ok:true}})}
 async function invoices(oid,uid){requireReady();const m=await store.one('SELECT role FROM memberships WHERE organization_id=? AND user_id=?',[oid,uid]);if(m?.role!=='owner')fail(403,'Only the owner can view invoices.');const org=await store.one('SELECT customer_id FROM organizations WHERE id=?',[oid]);if(!org.customer_id)return [];const list=await stripe.invoices.list({customer:org.customer_id,limit:10});return list.data.map(i=>({id:i.id,number:i.number,status:i.status,amount:i.amount_paid,currency:i.currency,date:i.created,url:i.hosted_invoice_url}))}
 async function plans(){if(!configured)return {configured:false,mode:'unconfigured',plans:[]};const data=await Promise.all(Object.entries(prices).map(async([name,id])=>{const p=await stripe.prices.retrieve(id);if(!p.active||p.type!=='recurring'||p.recurring?.interval!=='month'||p.recurring.interval_count!==1)fail(503,'Configure active monthly recurring Stripe prices.');return {name,amount:p.unit_amount,currency:p.currency,interval:p.recurring.interval,limits:limits[name]}}));return {configured:true,mode:secretKey?.startsWith('sk_live_')?'live':'test',plans:data}}
 return {configured,checkout,portal,webhook,reconcile,invoices,plans};
}
