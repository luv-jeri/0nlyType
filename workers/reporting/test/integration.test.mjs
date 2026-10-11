import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { createHash, randomUUID, createHmac } from 'node:crypto'
import { build } from 'esbuild'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'

let mf, db, backend, media
const admin = 'a'.repeat(64), token='b'.repeat(64), healthToken='h'.repeat(64), origin='http://localhost:3000'
const ipSecret='local-test-contact-salt-'.repeat(3)
const githubActor={id:101,login:'reporting-maintainer'}
const hash = value => createHash('sha256').update(value).digest('hex')
const payload = (more={}) => ({id:randomUUID(),kind:'bug',title:'Dark mode button',description:'Switch to dark mode, then the menu disappears.',email:'person@example.com',references:[],pins:[],attachments:[],diagnostics:null,...more})
const request = (path, method='GET', body, auth, headers={}) => mf.dispatchFetch(`http://localhost${path}`,{method,headers:{Origin:origin,...(body!==undefined?{'Content-Type':'application/json'}:{}),...(auth?{Authorization:`Bearer ${auth}`} : {}),...headers},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})})
const submit = p => request('/v1/reports','POST',{report:p,token,turnstileToken:''},null,{'CF-Connecting-IP':p.id})
before(async()=>{
  const compiled=await build({entryPoints:['workers/reporting/src/index.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'})
  mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:compiled.outputFiles[0].text,compatibilityDate:'2026-09-01',d1Databases:['DB'],r2Buckets:['MEDIA'],bindings:{ALLOWED_ORIGINS:origin,SITE_URL:'https://thedirectors.agency/ui',LOCAL_MODE:'true',ADMIN_TOKEN:admin,HEALTH_TOKEN:healthToken,IP_HASH_SECRET:ipSecret,GITHUB_REPOSITORY:'owner/library',GITHUB_WEBHOOK_SECRET:'webhook-test-secret',DELIVERY_ACTIVATED_AT:'2020-01-01T00:00:00Z',RESEND_WEBHOOK_SECRET:'whsec_'+Buffer.from('test-webhook-secret').toString('base64')}}))
  db=await mf.getD1Database('DB')
  for(const name of (await readdir('workers/reporting/migrations')).filter(n=>n.endsWith('.sql')).sort()) await db.exec((await readFile(`workers/reporting/migrations/${name}`,'utf8')).replace(/\n/g,' '))
  media=await mf.getR2Bucket('MEDIA')
  const helpers=await build({stdin:{contents:'export { cleanup, updateFromAdmin } from "./workers/reporting/src/lifecycle.ts"; export { accept, componentURL, receipt, upload } from "./workers/reporting/src/reports.ts"; export { mirrorIssue, deliver, drain } from "./workers/reporting/src/delivery.ts";',resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',target:'es2022'})
  backend=await import(`data:text/javascript;base64,${Buffer.from(helpers.outputFiles[0].text).toString('base64')}`)
})
after(async()=>{await mf?.dispose();})
test("0dB origin policy cannot be widened by production configuration", async () => {
  const { origins, assertBrowserOrigin } = await import("../../../workers/reporting/src/security.ts")
  const configured = "https://thedirectors.agency,https://other-product.example,http://localhost:3000,https://unrelated.example,https://thedirectors.agency/ui"
  assert.deepEqual(origins({ ALLOWED_ORIGINS: configured, LOCAL_MODE: "false" }), ["https://thedirectors.agency"])
  assert.deepEqual(origins({ ALLOWED_ORIGINS: configured, LOCAL_MODE: "true" }), ["https://thedirectors.agency", "http://localhost:3000"])
  const env = { ALLOWED_ORIGINS: configured, LOCAL_MODE: "false" }
  assert.doesNotThrow(() => assertBrowserOrigin(new Request("https://feedback.thedirectors.agency/v1/reports", { headers: { Origin: "https://thedirectors.agency" } }), env))
  for (const origin of ["https://other-product.example", "http://localhost:3000", "https://thedirectors.agency/ui", "https://feedback.thedirectors.agency"]) {
    assert.throws(() => assertBrowserOrigin(new Request("https://feedback.thedirectors.agency/v1/reports", { headers: { Origin: origin } }), env), error => error.status === 403)
  }

})

test("committed reporting configs isolate the agency and keep email disabled", async () => {
  for (const name of ["wrangler.jsonc", "wrangler.local.jsonc"]) {
    const source = await readFile(`workers/reporting/${name}`, "utf8")
    const config = JSON.parse(source.replace(/^\s*\/\/.*$/gm, ""))
    assert.equal(config.vars.ALLOWED_ORIGINS, "https://thedirectors.agency")
    assert.equal(config.vars.SITE_URL, "https://thedirectors.agency/ui")
    assert.equal(config.vars.EMAIL_FROM, "hello@thedirectors.agency")
    assert.equal(config.vars.EMAIL_ENABLED, "false")
    if (name === "wrangler.jsonc") assert.deepEqual(config.routes, [{ pattern: "feedback.thedirectors.agency", custom_domain: true }])
  }
})

test("component releases require a single static 0dB docs slug", () => {
  assert.equal(backend.componentURL("https://thedirectors.agency/ui/docs/button/", backendEnv()), "https://thedirectors.agency/ui/docs/button/")
  for (const url of ["https://thedirectors.agency/docs/button/", "https://thedirectors.agency/ui-other/docs/button/", "https://other-product.example/docs/button/", "https://unrelated.example/ui/docs/button/"]) {
    assert.throws(() => backend.componentURL(url, backendEnv()), error => error.status === 422)
  }
  for (const path of ["/docs/", "/docs/button/private/", "/docs/%73ecret/", "/docs/button/?token=x", "/docs/button/#private"]) {
    assert.throws(() => backend.componentURL(`https://thedirectors.agency/ui${path}`, backendEnv()), error => error.status === 422)
  }
  assert.equal(backend.componentURL("http://localhost:3000/ui/docs/button/", backendEnv({ SITE_URL: "http://localhost:3000/ui" })), "http://localhost:3000/ui/docs/button/")
  assert.throws(() => backend.componentURL("http://localhost:3000/docs/button/", backendEnv({ SITE_URL: "http://localhost:3000/ui" })), error => error.status === 422)
})

test("documented deletion removes private records and metadata while preserving another contributor", async () => {
  const original = payload({ kind: "request", title: "Deletion procedure example" })
  await submit(original)
  const joined = payload({ kind: "request", title: original.title, topicId: original.id, email: "other-contributor@example.com" })
  await submit(joined)
  const providerId = `deletion-${original.id}`
  await db.prepare("UPDATE outbox SET provider_id=? WHERE id=?").bind(providerId, `${original.id}:email_received`).run()
  await db.prepare("INSERT INTO email_events VALUES(?,?,?,?,?)").bind(randomUUID(), providerId, "delivered", Date.now(), Date.now()).run()
  await db.prepare("INSERT INTO email_attempts VALUES(?,?,?)").bind(randomUUID(), `${original.id}:email_received`, Date.now()).run()
  const runbook = await readFile("docs/reporting/OPERATIONS.md", "utf8")
  const sql = runbook.match(/```sql\n([\s\S]*?)\n\s*```/)[1]
  const erase = async reportId => db.exec(sql.replaceAll("<REPORT_UUID>", reportId).replaceAll("<TOPIC_UUID>", original.id).replace(/\n/g, " "))
  await erase(original.id)
  assert.equal(await db.prepare("SELECT id FROM reports WHERE id=?").bind(original.id).first(), null)
  assert.equal(await db.prepare("SELECT id FROM outbox WHERE report_id=?").bind(original.id).first(), null)
  assert.equal(await db.prepare("SELECT id FROM email_events WHERE provider_id=?").bind(providerId).first(), null)
  assert.equal(await db.prepare("SELECT id FROM email_attempts WHERE job_id=?").bind(`${original.id}:email_received`).first(), null)
  assert.ok(await db.prepare("SELECT id FROM reports WHERE id=?").bind(joined.id).first())
  const retained = await db.prepare("SELECT title,title_key FROM topics WHERE id=?").bind(original.id).first()
  assert.deepEqual(retained, { title: "[Deleted request]", title_key: `deleted:${original.id}` })
  assert.equal((await request(`/v1/reports/${original.id}`, "GET", undefined, token)).status, 404)
  await erase(joined.id)
  assert.equal(await db.prepare("SELECT id FROM topics WHERE id=?").bind(original.id).first(), null)
})

test("an upload crossing retention cleanup removes its just-written object and cannot claim success", async () => {
  const bytes = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])
  const file = { id: randomUUID(), name: "private.png", type: "image/png", size: bytes.length, sha256: hash(bytes) }
  const p = payload({ attachments: [file] })
  await submit(p)
  const racingMedia = {
    put: async (...args) => {
      await db.prepare("UPDATE reports SET created_at=? WHERE id=?").bind(Date.now() - 31 * 86400000, p.id).run()
      await backend.cleanup(backendEnv())
      return media.put(...args)
    },
    delete: key => media.delete(key),
  }
  const incoming = new Request(`http://localhost/v1/reports/${p.id}/attachments/${file.id}`, {
    method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type }, body: bytes,
  })
  await assert.rejects(backend.upload(incoming, backendEnv({ MEDIA: racingMedia }), p.id, file.id), error => error.status === 410)
  assert.equal(await media.get(`${p.id}/${file.id}`), null)
  assert.equal(await db.prepare("SELECT id FROM attachments WHERE report_id=?").bind(p.id).first(), null)
})

test("a failed overwrite retry preserves an already uploaded attachment", async () => {
  const bytes = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])
  const file = { id: randomUUID(), name: "saved.png", type: "image/png", size: bytes.length, sha256: hash(bytes) }
  const p = payload({ attachments: [file] })
  await submit(p)
  const incoming = () => new Request(`http://localhost/v1/reports/${p.id}/attachments/${file.id}`, {
    method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type }, body: bytes,
  })
  await backend.upload(incoming(), backendEnv(), p.id, file.id)
  const unavailableMedia = { put: async () => { throw new Error("R2 unavailable") }, delete: key => media.delete(key) }
  await assert.rejects(backend.upload(incoming(), backendEnv({ MEDIA: unavailableMedia }), p.id, file.id), /R2 unavailable/)
  assert.deepEqual(new Uint8Array(await (await media.get(`${p.id}/${file.id}`)).arrayBuffer()), bytes)
  assert.equal((await db.prepare("SELECT state FROM attachments WHERE report_id=? AND id=?").bind(p.id, file.id).first()).state, "uploaded")
})
test('saves first, returns stable receipt, refuses changed retry and wrong token',async()=>{
  const p=payload(); const first=await submit(p); assert.equal(first.status,201); const receipt=await first.json()
  assert.equal(receipt.id,p.id); assert.equal(receipt.email,'setup_required'); assert.equal(receipt.token,token)
  assert.equal((await submit(p)).status,200)
  assert.equal((await submit({...p,description:'Changed after acceptance'})).status,409)
  assert.equal((await request(`/v1/reports/${p.id}`,'GET',undefined,'wrong')).status,404)
  const row=await db.prepare('SELECT count(*) AS n FROM reports WHERE id=?').bind(p.id).first();assert.equal(row.n,1)
})
test('rejects oversized and malformed reports without storing them',async()=>{
  const p=payload({email:''});assert.equal((await submit(p)).status,422)
  assert.equal(await db.prepare('SELECT id FROM reports WHERE id=?').bind(p.id).first(),null)
  assert.equal((await request('/v1/reports','POST','x'.repeat(200000))).status,413)
  assert.equal((await request('/v1/reports','POST',{report:payload(),token},null,{Origin:'https://evil.test'})).status,403)
})
test('attachment checks preserve accepted text and enforce receipt authorization',async()=>{
  const bytes=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);const fileId=randomUUID()
  const p=payload({attachments:[{id:fileId,name:'capture.png',type:'image/png',size:bytes.length,sha256:hash(bytes)}]})
  assert.equal((await submit(p)).status,201); const url=`http://localhost/v1/reports/${p.id}/attachments/${fileId}`
  const upload=(data,auth=token)=>mf.dispatchFetch(url,{method:'PUT',headers:{Origin:origin,Authorization:`Bearer ${auth}`,'Content-Type':'image/png'},body:data})
  assert.equal((await upload(bytes,'wrong')).status,404)
  assert.equal((await upload(new Uint8Array(bytes.length))).status,422)
  assert.equal((await request(`/v1/reports/${p.id}`,'GET',undefined,token)).status,200)
  assert.equal((await upload(bytes)).status,200);assert.equal((await upload(bytes)).status,200)
  const media=await request(`/v1/admin/reports/${p.id}/attachments/${fileId}`,'GET',undefined,admin)
  assert.equal(media.status,200);assert.deepEqual(new Uint8Array(await media.arrayBuffer()),bytes)
  assert.equal((await request(`/v1/admin/reports/${p.id}/attachments/${fileId}`)).status,401)
})
test('public demand counts distinct email while private details stay out of responses',async()=>{
  const a=payload({kind:'request',title:'Timeline comparison',description:'Private client name',email:'a@example.com'})
  await submit(a);const b=payload({...a,id:randomUUID(),email:'b@example.com',topicId:a.id});await submit(b);await submit(payload({...a,id:randomUUID(),topicId:a.id}))
  const response=await request('/v1/requests'); const raw=await response.text();const topic=JSON.parse(raw).requests.find(x=>x.id===a.id)
  assert.equal(topic.demand,2);assert.ok(!raw.includes('example.com')&&!raw.includes('Private client'))
  assert.equal((await request(`/v1/admin/reports/${a.id}`)).status,401)
})
test('completion updates all topic subscribers and queues one notification each',async()=>{
  const a=payload({kind:'request',title:'Complete topic'});await submit(a)
  const b=payload({kind:'request',title:a.title,topicId:a.id,email:'second@example.com'});await submit(b)
  assert.equal((await request(`/v1/admin/reports/${a.id}`,'PATCH',{status:'resolved'},admin)).status,422)
  assert.equal((await request(`/v1/admin/reports/${a.id}`,'PATCH',{status:'resolved',componentUrl:'https://evil.test/docs/button/'},admin)).status,422)
  const update={status:'resolved',componentUrl:'https://thedirectors.agency/ui/docs/button/'}
  assert.equal((await request(`/v1/admin/reports/${a.id}`,'PATCH',update,admin)).status,200)
  assert.equal((await request(`/v1/admin/reports/${a.id}`,'PATCH',update,admin)).status,200)
  const jobs=await db.prepare("SELECT * FROM outbox WHERE kind='email_resolved' AND report_id IN (?,?)").bind(a.id,b.id).all();assert.equal(jobs.results.length,2)
  assert.equal((await db.prepare('SELECT status FROM reports WHERE id=?').bind(b.id).first()).status,'resolved')
})
test('production protection fails closed and GitHub signatures are mandatory',async()=>{
  const closed=await mf.dispatchFetch('https://api.example.com/v1/reports',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({report:payload(),token})});assert.equal(closed.status,503)
  assert.equal((await request('/v1/github/webhook','POST',{})).status,401)
  const body=JSON.stringify({action:'closed',repository:{full_name:'other/repo'},issue:{number:123}})
  const sig='sha256='+createHmac('sha256','webhook-test-secret').update(body).digest('hex')
  assert.equal((await request('/v1/github/webhook','POST',body,null,{'X-Hub-Signature-256':sig,'X-GitHub-Event':'issues','X-GitHub-Delivery':randomUUID()})).status,202)
})

const backendEnv=more=>({DB:db,MEDIA:media,LOCAL_MODE:'true',SITE_URL:'https://thedirectors.agency/ui',IP_HASH_SECRET:ipSecret,DELIVERY_ACTIVATED_AT:'2020-01-01T00:00:00Z',...more})
test('joining a resolved request returns its live URL and sends an already-available acknowledgment',async()=>{
  const first=payload({kind:'request',title:'Already available component'});await submit(first)
  const componentUrl='https://thedirectors.agency/ui/docs/timeline/'
  assert.equal((await request(`/v1/admin/reports/${first.id}`,'PATCH',{status:'resolved',componentUrl},admin)).status,200)
  const joined=payload({kind:'request',title:first.title,topicId:first.id,email:'late-requester@example.com'})
  const response=await submit(joined);assert.equal(response.status,201);const receipt=await response.json()
  const emails=[]
  await backend.drain(resendEnv(),joined.id,async(_url,init)=>{emails.push(JSON.parse(init.body));return Response.json({id:'already-available-ack'});})
  assert.equal(emails.length,1)
  const refreshed=await (await request(`/v1/reports/${joined.id}`,'GET',undefined,token)).json()
  assert.deepEqual({status:receipt.status,componentUrl:receipt.componentUrl,refreshedUrl:refreshed.componentUrl,ackHasURL:emails[0].text.includes(componentUrl),ackHasLink:emails[0].html.includes(`href="${componentUrl}"`),ackSaysAvailable:/already available/i.test(emails[0].subject),promisesFuture:/notify you when the component is live/i.test(emails[0].text)},
    {status:'resolved',componentUrl,refreshedUrl:componentUrl,ackHasURL:true,ackHasLink:true,ackSaysAvailable:true,promisesFuture:false})
  assert.equal((await db.prepare("SELECT count(*) AS n FROM outbox WHERE report_id=? AND kind='email_resolved'").bind(joined.id).first()).n,0)
})
test('local request resolution permits matching loopback HTTP while all other HTTP stays forbidden',async()=>{
  const p=payload({kind:'request',title:'Local component release'});await submit(p)
  for(const site of ['http://localhost:3000']) {
    const componentUrl=`${site}/docs/button/`
    await backend.updateFromAdmin(backendEnv({SITE_URL:site}),p.id,{status:'resolved',componentUrl})
    const row=await db.prepare('SELECT status,component_url FROM reports WHERE id=?').bind(p.id).first()
    assert.deepEqual(row,{status:'resolved',component_url:componentUrl})
  }
  const cases=[
    {site:'http://localhost:3000',url:'http://localhost:3000/docs/button/',local:'false'},
    {site:'http://library.example.com',url:'http://library.example.com/docs/button/',local:'true'},
    {site:'http://localhost:3100',url:'http://127.0.0.1:3100/docs/button/',local:'true'},
    {site:'http://localhost:3100',url:'http://localhost:3100/docs/button/',local:'true'},
    {site:'https://unrelated.example',url:'https://unrelated.example/docs/button/',local:'false'},
    {site:'http://localhost:3100',url:'http://user@localhost:3100/docs/button/',local:'true'},
  ]
  for(const item of cases) assert.throws(()=>backend.componentURL(item.url,backendEnv({SITE_URL:item.site,LOCAL_MODE:item.local})),error=>error.status===422)
  assert.equal(backend.componentURL('https://thedirectors.agency/ui/docs/button/',backendEnv({LOCAL_MODE:'false'})),'https://thedirectors.agency/ui/docs/button/')
})
test('contact expiry preserves distinct demand across old and new contributions',async()=>{
  const a=payload({kind:'request',title:'Retention demand example',email:'retention-a@example.com'})
  await submit(a)
  const b=payload({...a,id:randomUUID(),topicId:a.id,email:'retention-b@example.com'})
  const duplicate=payload({...a,id:randomUUID(),topicId:a.id})
  await submit(b);await submit(duplicate)
  await db.prepare('UPDATE reports SET created_at=? WHERE topic_id=?').bind(Date.now()-181*86400000,a.id).run()
  await backend.cleanup(backendEnv())
  const topics=await (await request('/v1/requests')).json()
  assert.equal(topics.requests.find(topic=>topic.id===a.id).demand,2)
  await submit(payload({...a,id:randomUUID(),topicId:a.id}))
  const after=await (await request('/v1/requests')).json()
  assert.equal(after.requests.find(topic=>topic.id===a.id).demand,2)
  assert.equal((await db.prepare('SELECT email FROM reports WHERE id=?').bind(a.id).first()).email,'')
})
test('cleanup removes expired attachment metadata as well as objects',async()=>{
  const bytes=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])
  const file={id:randomUUID(),name:'private-client-acquisition.png',type:'image/png',size:bytes.length,sha256:hash(bytes)}
  const p=payload({title:'Private acquisition report title',description:'Private acquisition details',attachments:[file]})
  await submit(p)
  await mf.dispatchFetch(`http://localhost/v1/reports/${p.id}/attachments/${file.id}`,{method:'PUT',headers:{Origin:origin,Authorization:`Bearer ${token}`,'Content-Type':file.type},body:bytes})
  await db.prepare('UPDATE reports SET created_at=? WHERE id=?').bind(Date.now()-31*86400000,p.id).run()
  await backend.cleanup(backendEnv())
  assert.equal(await media.get(`${p.id}/${file.id}`),null)
  const technical=await (await request(`/v1/admin/reports/${p.id}`,'GET',undefined,admin)).text()
  assert.ok(!technical.includes(file.name),'attachment filename must expire with its media')
  assert.equal(await db.prepare('SELECT sha256 FROM attachments WHERE report_id=?').bind(p.id).first(),null)
})
test('cleanup removes expired private bug titles along with other private prose',async()=>{
  const p=payload({title:'Private acquisition report title',description:'Private acquisition details'})
  await submit(p)
  await db.prepare('UPDATE reports SET created_at=? WHERE id=?').bind(Date.now()-181*86400000,p.id).run()
  await backend.cleanup(backendEnv())
  const privateData=await (await request(`/v1/admin/reports/${p.id}`,'GET',undefined,admin)).text()
  assert.ok(!privateData.includes(p.title)&&!privateData.includes(p.description)&&!privateData.includes(p.email))
})
test('cleanup retires normalized private request titles without collisions and preserves explicit subscriptions',async()=>{
  const a=payload({kind:'request',title:'Confidential Meridian acquisition'})
  const b=payload({kind:'request',title:'Confidential Juniper acquisition'})
  await submit(a);await submit(b)
  await db.prepare('UPDATE topics SET created_at=? WHERE id IN (?,?)').bind(Date.now()-181*86400000,a.id,b.id).run()
  await db.prepare('UPDATE reports SET created_at=? WHERE id IN (?,?)').bind(Date.now()-181*86400000,a.id,b.id).run()
  await db.prepare('UPDATE topics SET public_title=? WHERE id=?').bind('Comparison timeline',a.id).run()
  await backend.cleanup(backendEnv())
  const expired=await db.prepare('SELECT title,title_key,public_title FROM topics WHERE id IN (?,?)').bind(a.id,b.id).all()
  assert.ok(!JSON.stringify(expired.results).toLowerCase().includes('confidential'),'both original and normalized private title must expire')
  assert.equal(new Set(expired.results.map(topic=>topic.title_key)).size,2,'retired keys must respect the unique index')
  assert.ok(expired.results.some(topic=>topic.public_title==='Comparison timeline'),'approved public title remains')
  const fresh=payload({kind:'request',title:a.title});const response=await submit(fresh)
  assert.equal(response.status,201);assert.equal((await response.json()).topicId,fresh.id,'expired automatic title deduplication ends')
  const joined=await submit(payload({kind:'request',title:a.title,topicId:a.id,email:'subscriber@example.com'}))
  assert.equal(joined.status,201);assert.equal((await joined.json()).topicId,a.id,'explicit subscriptions retain the old topic identity')
  await backend.cleanup(backendEnv())
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM topics WHERE id IN (?,?)').bind(a.id,b.id).first()).n,2,'repeated cleanup is safe')
})
test('GitHub reconciliation binds markers to the report actor and creation window and keeps prose private',async()=>{
  const p=payload({title:'Private bug title',description:'Private description',email:'private-address@example.com',references:['https://private.example.com/secret']})
  await submit(p);const row=await db.prepare('SELECT * FROM reports WHERE id=?').bind(p.id).first()
  const env=backendEnv({GITHUB_TOKEN:'test-only-github-token',GITHUB_REPOSITORY:'owner/library'})
  let original
  await backend.mirrorIssue(env,row,async(url,init)=>{
    if(url==='https://api.github.com/user') return Response.json(githubActor)
    assert.ok(url.startsWith('https://api.github.com/repos/owner/library/issues'))
    if(init.method!=='POST') return Response.json([])
    const outgoing=JSON.parse(init.body)
    for(const secret of [p.title,p.description,p.email,p.references[0],token]) assert.ok(!init.body.includes(secret))
    assert.ok(outgoing.body.includes('/feedback-admin/?report='))
    original={number:21,node_id:'I_original',html_url:'https://github.com/owner/library/issues/21',body:outgoing.body,user:githubActor,created_at:new Date(row.created_at).toISOString()}
    return Response.json(original,{status:201})
  })
  const copied={...original,number:232,node_id:'I_copy',html_url:'https://github.com/owner/library/issues/232'}
  const olderAttacker={...original,number:5,user:{id:999,login:'attacker'}}
  const preexistingOwn={...original,number:6,created_at:new Date(row.created_at-86400000).toISOString()}
  const firstPage=[copied,...Array.from({length:99},(_,index)=>({number:231-index,body:'Another report'}))]
  const reconciled=await backend.mirrorIssue(env,row,async(url,init)=>{
    if(url==='https://api.github.com/user') return Response.json(githubActor)
    assert.notEqual(init.method,'POST','must reconcile the original accepted issue')
    return Response.json(new URL(url).searchParams.get('page')==='1'?firstPage:[original,olderAttacker,preexistingOwn])
  })
  assert.equal(reconciled.number,21)
})
test('ambiguous GitHub POST is reconciled before another issue can be created',async()=>{
  const p=payload();await submit(p)
  const row=await db.prepare('SELECT * FROM reports WHERE id=?').bind(p.id).first()
  const job=await db.prepare("SELECT * FROM outbox WHERE report_id=? AND kind='github'").bind(p.id).first()
  const env=backendEnv({GITHUB_TOKEN:'test-only-github-token',GITHUB_REPOSITORY:'owner/library'})
  let accepted,posts=0
  const provider=async(url,init)=>{
    if(url==='https://api.github.com/user') return Response.json(githubActor)
    if(init.method!=='POST') return Response.json(accepted?[accepted]:[])
    posts++;accepted={number:42,node_id:'I_accepted',html_url:'https://github.com/owner/library/issues/42',body:JSON.parse(init.body).body,user:githubActor,created_at:new Date(row.created_at).toISOString()}
    throw new Error('Connection lost after GitHub accepted')
  }
  await assert.rejects(backend.deliver(env,job,row,provider),error=>error.ambiguous===true)
  assert.equal(await backend.deliver(env,job,row,provider),'42')
  assert.equal(posts,1)
  assert.equal((await db.prepare('SELECT issue_number FROM reports WHERE id=?').bind(p.id).first()).issue_number,42)
})
test('ambiguous email outcome is held for review without automatic duplicate sends',async()=>{
  const p=payload();await submit(p);let sends=0
  const env=resendEnv(),provider=async()=>{sends++;throw new Error('Response lost after provider acceptance');}
  await backend.drain(env,p.id,provider);await backend.drain(env,p.id,provider)
  const job=await db.prepare("SELECT * FROM outbox WHERE report_id=? AND kind='email_received'").bind(p.id).first()
  assert.equal(job.state,'needs_review');assert.equal(job.attempts,1);assert.equal(sends,1)
  assert.ok(await db.prepare('SELECT id FROM reports WHERE id=?').bind(p.id).first())
})
test('email rate limits retry safely and concurrent drains claim each email once',async()=>{
  const p=payload();await submit(p);let sends=0
  const env=resendEnv(),provider=async()=>{sends++;return sends===1?Response.json({name:'rate_limit_exceeded'},{status:429}):Response.json({id:'email-accepted'});}
  await backend.drain(env,p.id,provider)
  let job=await db.prepare("SELECT * FROM outbox WHERE report_id=? AND kind='email_received'").bind(p.id).first()
  assert.equal(job.state,'pending');assert.ok(job.due_at>Date.now())
  await db.prepare('UPDATE outbox SET due_at=0 WHERE id=?').bind(job.id).run()
  await Promise.all([backend.drain(env,p.id,provider),backend.drain(env,p.id,provider)])
  job=await db.prepare('SELECT * FROM outbox WHERE id=?').bind(job.id).first()
  assert.equal(job.state,'done');assert.equal(job.provider_id,'email-accepted');assert.equal(sends,2)
})
test('expired processing leases require explicit review instead of resending',async()=>{
  const p=payload();await submit(p);let sends=0
  await db.prepare("UPDATE outbox SET state='processing',lease_until=0 WHERE report_id=? AND kind='email_received'").bind(p.id).run()
  await backend.drain(resendEnv(),p.id,async()=>{sends++;return Response.json({id:'unexpected'});})
  assert.equal((await db.prepare("SELECT state FROM outbox WHERE report_id=? AND kind='email_received'").bind(p.id).first()).state,'needs_review')
  assert.equal(sends,0)
})
test('disabled email backlog cannot starve a configured GitHub delivery',async()=>{
  const p=payload();await submit(p)
  await db.prepare('UPDATE reports SET issue_number=77,issue_node_id=?,issue_url=? WHERE id=?').bind('I_existing','https://github.com/owner/library/issues/77',p.id).run()
  await db.batch(Array.from({length:25},(_,index)=>db.prepare("INSERT INTO outbox(id,report_id,kind,due_at,created_at) VALUES(?,?,'email_received',0,0)").bind(`${p.id}:old-email-${index}`,p.id)))
  // The persisted GitHub receipt needs no external call when its outbox completion is recovered.
  const result=await backend.drain(backendEnv({GITHUB_TOKEN:'test-only-token',GITHUB_REPOSITORY:'owner/library'}),p.id)
  assert.equal(result.processed,1)
  const job=await db.prepare("SELECT state,provider_id FROM outbox WHERE report_id=? AND kind='github'").bind(p.id).first()
  assert.equal(job.state,'done');assert.equal(job.provider_id,'77')
})
test('GitHub release automation requires release label and component URL and deduplicates replays',async()=>{
  const p=payload({kind:'request',title:'Webhook release example'});await submit(p)
  await db.prepare('UPDATE reports SET issue_number=91 WHERE id=?').bind(p.id).run()
  const base={action:'closed',repository:{full_name:'owner/library'},issue:{number:91,state:'closed',state_reason:'completed',updated_at:new Date().toISOString(),labels:[],body:''}}
  const send=async(body,id=randomUUID())=>{
    const raw=JSON.stringify(body);const sig='sha256='+createHmac('sha256','webhook-test-secret').update(raw).digest('hex')
    return request('/v1/github/webhook','POST',raw,null,{'X-Hub-Signature-256':sig,'X-GitHub-Event':'issues','X-GitHub-Delivery':id})
  }
  assert.equal((await send(base)).status,202)
  assert.equal((await db.prepare('SELECT status FROM reports WHERE id=?').bind(p.id).first()).status,'received')
  const released={...base,issue:{...base.issue,labels:[{name:'feedback:released'}]}}
  assert.equal((await send(released)).status,422)
  released.issue.body='Component: https://thedirectors.agency/ui/docs/timeline/'
  const eventId=randomUUID();assert.equal((await send(released,eventId)).status,202)
  const replay=await send(released,eventId);assert.equal((await replay.json()).duplicate,true)
  assert.equal((await db.prepare('SELECT status FROM reports WHERE id=?').bind(p.id).first()).status,'resolved')
  assert.equal((await db.prepare("SELECT count(*) AS n FROM outbox WHERE report_id=? AND kind='email_resolved'").bind(p.id).first()).n,1)
})

const resendEnv=more=>backendEnv({ENVIRONMENT:'production',DELIVERY_ACTIVATED_AT:'2020-01-01T00:00:00Z',EMAIL_ENABLED:'true',EMAIL_FROM:'hello@thedirectors.agency',RESEND_API_KEY:'test-only-resend-key',...more})
test('health discloses only release identity publicly and requires admin for queue diagnostics',async()=>{
  const response=await request('/health');assert.equal(response.status,200)
  assert.deepEqual(Object.keys(await response.json()).sort(),['environment','release','status'])
  assert.equal((await request('/v1/admin/health')).status,401)
  const health=await request('/v1/admin/health','GET',undefined,admin);assert.equal(health.status,200)
  assert.ok((await health.json()).queue)
})
test('health-only credential can read diagnostics but cannot read reports, attachments or mutate admin state',async()=>{
  assert.equal((await request('/v1/admin/health','GET',undefined,healthToken)).status,200)
  for(const [url,method,body] of [['/v1/admin/reports','GET'],['/v1/admin/reports/example','GET'],['/v1/admin/reports/example/attachments/example','GET'],['/v1/admin/reports/example','PATCH',{status:'resolved'}],['/v1/admin/deliveries/example/retry','POST',{}],['/v1/admin/health','POST',{}],['/v1/admin/health','HEAD']]) {
    assert.equal((await request(url,method,body,healthToken)).status,401)
  }
})
test('free text request titles remain private until a maintainer publishes a safe title',async()=>{
  const p=payload({kind:'request',title:'Secret acquisition of Acme'});await submit(p)
  assert.ok(!(await (await request('/v1/requests')).text()).includes(p.title))
  const row=await db.prepare('SELECT * FROM reports WHERE id=?').bind(p.id).first()
  await backend.mirrorIssue(backendEnv({GITHUB_TOKEN:'test',GITHUB_REPOSITORY:'owner/library'}),row,async(url,init)=>{
    if(url.endsWith('/user')) return Response.json(githubActor)
    if(init.method!=='POST') return Response.json([])
    assert.ok(!init.body.includes(p.title));return Response.json({number:201,node_id:'I_safe',html_url:'https://github.com/owner/library/issues/201'})
  })
  assert.equal((await request(`/v1/admin/reports/${p.id}`,'PATCH',{publicTitle:'Comparison timeline'},admin)).status,200)
  assert.ok((await (await request('/v1/requests')).text()).includes('Comparison timeline'))
})
test('provider activation alone cannot drain historical jobs',async()=>{
  const p=payload();await submit(p);let sends=0
  const provider=async()=>{sends++;return Response.json({id:'unexpected'});}
  await backend.drain(resendEnv({DELIVERY_ACTIVATED_AT:undefined}),p.id,provider)
  await backend.drain(resendEnv({DELIVERY_ACTIVATED_AT:new Date(Date.now()+1000).toISOString()}),p.id,provider)
  assert.equal(sends,0)
  assert.equal((await db.prepare("SELECT state FROM outbox WHERE id=?").bind(`${p.id}:email_received`).first()).state,'held')
})
test('the receipt separates a held GitHub job from a queued one and from an unconfigured tracker',async()=>{
  const p=payload();await submit(p)
  const configured=backendEnv({GITHUB_TOKEN:'test-only-github-token',GITHUB_REPOSITORY:'owner/library'})
  const read=async env=>await backend.receipt(env,await db.prepare('SELECT * FROM reports WHERE id=?').bind(p.id).first(),token)
  let issued=await read(configured)
  assert.equal(issued.issue,'pending');assert.equal(issued.issueDelivery,'pending')
  // No activation cutoff holds every pending job, GitHub included: the held update has no kind filter.
  await backend.drain({...configured,DELIVERY_ACTIVATED_AT:undefined},p.id)
  assert.equal((await db.prepare('SELECT state FROM outbox WHERE id=?').bind(`${p.id}:github`).first()).state,'held')
  issued=await read(configured)
  assert.equal(issued.issue,'pending','the legacy enum still reports pending for a configured tracker')
  assert.equal(issued.issueDelivery,'held','a held job must be distinguishable from a queued one')
  // The same held row on a build with no GitHub credentials is setup required, not queued.
  assert.equal((await read(backendEnv())).issue,'setup_required')
  // The receipt route must carry the new field to the browser, not only the internal helper.
  const overWire=await (await request(`/v1/reports/${p.id}`,'GET',undefined,token)).json()
  assert.equal(overWire.issueDelivery,'held')
  await db.prepare("UPDATE outbox SET state='needs_review' WHERE id=?").bind(`${p.id}:github`).run()
  assert.equal((await read(configured)).issue,'needs_review')
  await db.prepare('UPDATE reports SET issue_number=?,issue_url=? WHERE id=?').bind(4321,'https://github.com/owner/library/issues/4321',p.id).run()
  issued=await read(configured)
  assert.equal(issued.issue,'created');assert.equal(issued.issueDelivery,'needs_review','a created issue keeps the job state visible for review')
})
test('Resend persists one payload and key, records acceptance, and rejects payload drift',async()=>{
  const p=payload();await submit(p);const row=await db.prepare('SELECT * FROM reports WHERE id=?').bind(p.id).first()
  const job=await db.prepare('SELECT * FROM outbox WHERE id=?').bind(`${p.id}:email_received`).first()
  const calls=[];const provider=async(url,init)=>{calls.push(init);assert.equal(url,'https://api.resend.com/emails');return Response.json({id:'resend-accepted'});}
  assert.equal(await backend.deliver(resendEnv(),job,row,provider),'resend-accepted')
  const sent=JSON.parse(calls[0].body)
  assert.equal(sent.from,"0nlyType <hello@thedirectors.agency>")
  assert.equal(sent.reply_to,"hello@thedirectors.agency")
  assert.match(sent.subject,/ · 0nlyType$/)
  assert.match(sent.text,/\n\n0nlyType$/)
  assert.match(sent.html,/>0nlyType<\/p>/)
  assert.doesNotMatch(sent.html,/<a[^>]*style="[^"]*(?:background|border-radius)/)
  assert.equal(calls[0].headers['Idempotency-Key'],`0db/${job.id}`)
  await assert.rejects(backend.deliver(resendEnv({EMAIL_FROM:'different@thedirectors.agency'}),job,row,provider),/payload/i)
  assert.equal(calls.length,1)
})
test('uncertain sends cannot be replayed after the 24 hour provider window',async()=>{
  const p=payload();await submit(p);let sends=0
  const provider=async()=>{sends++;throw new Error('lost response');}
  await backend.drain(resendEnv(),p.id,provider)
  let job=await db.prepare('SELECT * FROM outbox WHERE id=?').bind(`${p.id}:email_received`).first()
  assert.equal(job.state,'needs_review');assert.equal(sends,1)
  await db.prepare("UPDATE outbox SET first_attempt_at=?,state='pending',due_at=0 WHERE id=?").bind(Date.now()-86400001,job.id).run()
  await backend.drain(resendEnv(),p.id,provider);assert.equal(sends,1)
  job=await db.prepare('SELECT * FROM outbox WHERE id=?').bind(job.id).first();assert.equal(job.state,'needs_review')
  assert.equal((await request(`/v1/admin/deliveries/${encodeURIComponent(job.id)}/retry`,'POST',{},admin)).status,409)
})
test('beta blocks non-testers and concurrent drains respect a reduced UTC quota',async()=>{
  await db.prepare('DELETE FROM email_attempts').run()
  const outsider=payload();await submit(outsider);let sends=0
  const provider=async()=>{sends++;return Response.json({id:`beta-${sends}`});}
  const env=resendEnv({ENVIRONMENT:'beta',EMAIL_DAILY_LIMIT:'1'})
  await backend.drain(env,outsider.id,provider);assert.equal(sends,0)
  const a=payload({email:'tester@example.com'}),b=payload({email:'tester@example.com'});await submit(a);await submit(b)
  await Promise.all([backend.drain(env,a.id,provider),backend.drain(env,b.id,provider)])
  assert.equal(sends,1)
  const jobs=await db.prepare("SELECT state,delivery_status FROM outbox WHERE report_id IN (?,?) AND kind='email_received'").bind(a.id,b.id).all()
  assert.deepEqual(jobs.results.map(j=>j.state).sort(),['done','pending']);assert.ok(jobs.results.some(j=>j.delivery_status==='quota'))
})

const resendHook=(body,more={})=>{
  const raw=typeof body==='string'?body:JSON.stringify(body),id=more.id??'msg_'+randomUUID(),timestamp=String(more.timestamp??Math.floor(Date.now()/1000))
  const signature=createHmac('sha256','test-webhook-secret').update(`${id}.${timestamp}.${raw}`).digest('base64')
  return request('/v1/resend/webhook','POST',raw,null,{'svix-id':id,'svix-timestamp':timestamp,'svix-signature':more.signature??`v1,${signature}`})
}
test('signed Resend events tolerate replay and ordering without treating acceptance as delivery',async()=>{
  const p=payload();await submit(p);const providerId='webhook-'+p.id
  // Provider events can win the race with the send response.
  const event={type:'email.delivered',created_at:new Date().toISOString(),data:{email_id:providerId}}
  const id='msg_'+randomUUID()
  assert.equal((await resendHook(event,{id})).status,202)
  assert.equal((await resendHook(event,{id})).status,202)
  await backend.drain(resendEnv(),p.id,async()=>Response.json({id:providerId}))
  assert.equal((await db.prepare('SELECT delivery_status FROM outbox WHERE id=?').bind(`${p.id}:email_received`).first()).delivery_status,'delivered')
  await resendHook({...event,type:'email.sent'})
  let receipt=await (await request(`/v1/reports/${p.id}`,'GET',undefined,token)).json();assert.equal(receipt.emailDelivery,'delivered');assert.equal(receipt.email,'sent')
  await Promise.all([resendHook({...event,type:'email.bounced'}),resendHook(event),resendHook({...event,type:'email.sent'})])
  receipt=await (await request(`/v1/reports/${p.id}`,'GET',undefined,token)).json();assert.equal(receipt.emailDelivery,'bounced');assert.equal(receipt.email,'needs_review')
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM email_events WHERE id=?').bind(id).first()).n,1)
})
test('Resend webhook rejects bad signatures, stale/future timestamps and invalid signed bodies generically',async()=>{
  const event={type:'email.delivered',created_at:new Date().toISOString(),data:{email_id:'private@example.com'}}
  for(const options of [{signature:'v1,garbage'},{timestamp:Math.floor(Date.now()/1000)-301},{timestamp:Math.floor(Date.now()/1000)+301}]) {
    const response=await resendHook(event,options);assert.equal(response.status,401);assert.equal((await response.json()).error,'Webhook not accepted.')
  }
  assert.equal((await resendHook('null')).status,400)
})
test('monthly ceiling retains jobs when the daily budget remains available',async()=>{
  await db.prepare('DELETE FROM email_attempts').run()
  const date=new Date(),month=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1)
  await db.prepare('INSERT INTO email_attempts VALUES(?,?,?)').bind(randomUUID(),'another-job',month).run()
  const p=payload();await submit(p);let sends=0
  await backend.drain(resendEnv({EMAIL_MONTHLY_LIMIT:'1'}),p.id,async()=>{sends++;return Response.json({id:'unexpected'});})
  assert.equal(sends,0);assert.equal((await db.prepare('SELECT state FROM outbox WHERE id=?').bind(`${p.id}:email_received`).first()).state,'pending')
})
test('beta intake rejects non-testers without storing their report',async()=>{
  const p=payload()
  const incoming=new Request('http://localhost/v1/reports',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':p.id},body:JSON.stringify({report:p,token})})
  await assert.rejects(backend.accept(incoming,resendEnv({ENVIRONMENT:'beta'})),error=>error.status===403)
  assert.equal(await db.prepare('SELECT id FROM reports WHERE id=?').bind(p.id).first(),null)
})
test('identical reviewed retries keep the payload/key and conflicts never auto-retry',async()=>{
  await db.prepare('DELETE FROM email_attempts').run()
  const p=payload();await submit(p);const row=await db.prepare('SELECT * FROM reports WHERE id=?').bind(p.id).first()
  const job=await db.prepare('SELECT * FROM outbox WHERE id=?').bind(`${p.id}:email_received`).first()
  const requests=[]
  await assert.rejects(backend.deliver(resendEnv(),job,row,async(_url,init)=>{requests.push(init);throw new Error('lost');}),error=>error.ambiguous)
  assert.equal(await backend.deliver(resendEnv(),job,row,async(_url,init)=>{requests.push(init);return Response.json({id:'safe-retry'});}),'safe-retry')
  assert.equal(requests[0].body,requests[1].body);assert.equal(requests[0].headers['Idempotency-Key'],requests[1].headers['Idempotency-Key'])
  const other=payload();await submit(other);let sends=0
  await backend.drain(resendEnv(),other.id,async()=>{sends++;return Response.json({name:'invalid_idempotent_request'},{status:409});})
  await backend.drain(resendEnv(),other.id,async()=>{sends++;return Response.json({id:'unexpected'});})
  assert.equal(sends,1);assert.equal((await db.prepare('SELECT state FROM outbox WHERE id=?').bind(`${other.id}:email_received`).first()).state,'needs_review')
})
test('production cannot raise the hard daily ceiling and previous UTC days do not consume today',async()=>{
  await db.prepare('DELETE FROM email_attempts').run()
  await db.prepare('WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<100) INSERT INTO email_attempts SELECT CAST(x AS TEXT),\'seed\',? FROM n').bind(Date.now()).run()
  const p=payload();await submit(p);let sends=0
  const provider=async()=>{sends++;return Response.json({id:'utc-success'});}
  await backend.drain(resendEnv({EMAIL_DAILY_LIMIT:'9999'}),p.id,provider);assert.equal(sends,0)
  await db.prepare('UPDATE email_attempts SET attempted_at=?').bind(Math.floor(Date.now()/86400000)*86400000-1).run()
  await db.prepare('UPDATE outbox SET due_at=0 WHERE id=?').bind(`${p.id}:email_received`).run()
  await backend.drain(resendEnv(),p.id,provider);assert.equal(sends,1)
})
test('provider quota responses retain a job after many attempts',async()=>{
  await db.prepare('DELETE FROM email_attempts').run()
  const p=payload();await submit(p);await db.prepare('UPDATE outbox SET attempts=99 WHERE id=?').bind(`${p.id}:email_received`).run()
  await backend.drain(resendEnv(),p.id,async()=>Response.json({name:'daily_quota_exceeded'},{status:429}))
  const job=await db.prepare('SELECT state,delivery_status FROM outbox WHERE id=?').bind(`${p.id}:email_received`).first()
  assert.deepEqual(job,{state:'pending',delivery_status:'quota'})
})
test('migration holds legacy pending/processing jobs without erasing receipts or approving legacy titles',async()=>{
  const legacy=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-09-01',d1Databases:['DB']}))
  try {
    const old=await legacy.getD1Database('DB');await old.exec((await readFile('workers/reporting/migrations/0001_reporting.sql','utf8')).replace(/\n/g,' '))
    const p=payload({kind:'request'});await submit(p)
    const topic=await db.prepare('SELECT id,title,title_key,status,component_url,created_at,updated_at FROM topics WHERE id=?').bind(p.id).first()
    await old.prepare('INSERT INTO topics VALUES(?,?,?,?,?,?,?)').bind(...Object.values(topic)).run()
    const row=await db.prepare('SELECT * FROM reports WHERE id=?').bind(p.id).first()
    await old.prepare(`INSERT INTO reports VALUES(${Object.keys(row).map(()=>'?').join(',')})`).bind(...Object.values(row)).run()
    for(const [kind,state] of [['github','pending'],['email_received','processing'],['email_resolved','done']]) await old.prepare('INSERT INTO outbox(id,report_id,kind,state,due_at,created_at) VALUES(?,?,?,?,0,0)').bind(`${p.id}:${kind}`,p.id,kind,state).run()
    await old.exec((await readFile('workers/reporting/migrations/0002_safe_delivery.sql','utf8')).replace(/\n/g,' '))
    assert.deepEqual((await old.prepare('SELECT state FROM outbox ORDER BY kind').all()).results.map(j=>j.state),['needs_review','done','held'])
    assert.equal((await old.prepare('SELECT public_title FROM topics').first()).public_title,null)
    assert.equal((await old.prepare('SELECT token_hash FROM reports').first()).token_hash,hash(token))
  } finally {await legacy.dispose();}
})
