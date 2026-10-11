import { keyedDigest } from "./security"
import { activationCutoff, emailEnabled, githubEnabled, now, type Delivery, type Env, type ReportRow } from "./types"
import { getReport } from "./reports"
import { sendResend, testerAllowed } from './resend'

export class DeliveryFailure extends Error {
  constructor(public reason: string, public ambiguous = false, public permanent = false, public quota = false) { super(reason); }
}
export const escapeHTML = (v:string) => v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!))
export function emailMessage(row: ReportRow, kind: string, site: string) {
  const completed=kind==="email_resolved"
  const alreadyAvailable=kind==="email_received"&&row.kind==="request"&&row.status==="resolved"&&!!row.component_url
  const heading=alreadyAvailable?"Your component is already available":completed?(row.kind==="request"?"Your component is live":"The issue you reported is fixed"):(row.kind==="request"?"Your component request is saved":"Thanks for reporting this")
  const message=alreadyAvailable?"The component you requested is already in the library. You can open it below.":completed?(row.kind==="request"?"The component you asked for is now in the library.":"We have released a fix for the issue you reported. Thank you for helping improve the library."):(row.kind==="request"?"We have received your request and added it to our work list. We will notify you when the component is live.":"We have received your report and added it to our work list. We will notify you when a fix is live.")
  const url=(completed||alreadyAvailable) && row.component_url?row.component_url:`${site.replace(/\/$/,"")}/requests/`
  const label=(completed||alreadyAvailable)&&row.component_url?"Open your component":"View component requests"
  const reference=`Reference: ${row.id}`
  const text=`${heading}\n\n${message}\n\n${reference}\n${label}: ${url}\n\n0nlyType`
  const html=`<!doctype html><html><body style="margin:0;background:#fbf4e6;color:#111;font:16px/1.6 Arial,sans-serif"><main style="max-width:560px;margin:36px auto;padding:32px"><p style="font-size:13px;letter-spacing:2px">0nlyType</p><h1 style="font-size:30px;line-height:1.2">${escapeHTML(heading)}</h1><p>${escapeHTML(message)}</p><p><a href="${escapeHTML(url)}" style="color:#111;text-decoration:underline">${label}</a></p><p style="font-size:12px;color:#5f5b55">${reference}</p></main></body></html>`
  return {subject:`${heading} · 0nlyType`,text,html}
}
async function github(env:Env,path:string,init:RequestInit={}, send=fetch) {
  let response:Response
  try { response=await send(`https://api.github.com${path}`,{...init,headers:{Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"0dB-Reporting","Content-Type":"application/json",...init.headers},signal:AbortSignal.timeout(15000)}); }
  catch { throw new DeliveryFailure("GitHub response unavailable; reconcile before retrying.",init.method==="POST"); }
  if(!response.ok) throw new DeliveryFailure(`GitHub returned HTTP ${response.status}.`,init.method==="POST"&&response.status>=500,[400,401,404,422].includes(response.status))
  try { return await response.json() as Record<string,unknown>; } catch { throw new DeliveryFailure("GitHub returned an unreadable response.",init.method==="POST"); }
}
type GitHubIssue={number:number;node_id:string;html_url:string;body?:string;created_at?:string;user?:{id:number;login:string};pull_request?:unknown}
export async function mirrorIssue(env:Env,row:ReportRow,send=fetch) {
  if(!githubEnabled(env)) throw new DeliveryFailure("GitHub setup required.",false,true)
  if(row.issue_number) return {number:row.issue_number,node_id:row.issue_node_id,html_url:row.issue_url}
  const actor=await github(env,"/user",{},send)
  if(typeof actor.id!=="number"||!Number.isSafeInteger(actor.id)||actor.id<=0) throw new DeliveryFailure("GitHub token owner could not be verified.",false,true)
  // A signed marker prevents a different contributor from spoofing a receipt.
  const marker=`<!-- 0db-report:${row.id}:${await keyedDigest(env.IP_HASH_SECRET??env.GITHUB_TOKEN!,`github-report:${row.id}`)} -->`
  const repo=`/repos/${env.GITHUB_REPOSITORY}`
  const since=new Date(row.created_at-60000).toISOString()
  let original:GitHubIssue|undefined
  for(let page=1;page<=10;page++) {
    const issues=await github(env,`${repo}/issues?state=all&sort=created&direction=desc&since=${encodeURIComponent(since)}&per_page=100&page=${page}`,{},send) as unknown as GitHubIssue[]
    // Public markers can be copied into older issues. Bind adoption to the token
    // owner's immutable ID and this report's creation window, then choose the first.
    for(const issue of issues) if(!issue.pull_request&&issue.user?.id===actor.id&&Date.parse(issue.created_at??"")>=row.created_at-60000&&issue.body?.includes(marker)&&(!original||issue.number<original.number)) original=issue
    if(issues.length<100) { if(original) return original; break; }
    if(page===10) throw new DeliveryFailure("Issue reconciliation needs a maintainer: too many matching pages.",false,true)
  }
  const title=`[${row.kind==="request"?"Component request":"Bug report"}] ${row.id.slice(0,8)}`
  const adminURL=`${env.SITE_URL.replace(/\/$/,"")}/feedback-admin/?report=${row.id}`
  const body=`${marker}\n\n${row.kind==="request"?"A component has been requested.":"A library bug has been reported."}\n\n[Open the complete report](${adminURL}) (maintainer access required).\n\nThe private report contains the description, reference links, screenshots or videos, selected elements, technical details and reply address. Attachments may still be uploading; their status is shown in the report.\n\nReference: \`${row.id}\`\n\nTrack progress in the report viewer. For release automation, close as completed with the \`feedback:released\` label. Component requests also require a line in this issue body: \`Component: ${env.SITE_URL.replace(/\/$/,"")}/docs/component-name/\`. Closing alone does not send a release email.`
  return await github(env,`${repo}/issues`,{method:"POST",body:JSON.stringify({title,body})},send) as unknown as GitHubIssue
}
export async function deliver(env:Env,job:Delivery,row:ReportRow,send=fetch):Promise<string> {
  if(row.private_purged) throw new DeliveryFailure("Private report expired.",false,true)
  if(job.kind==="github") {
    const issue=await mirrorIssue(env,row,send)
    if(!issue.number||!issue.node_id||!issue.html_url) throw new DeliveryFailure("GitHub issue receipt incomplete.",true)
    const statements=[env.DB.prepare("UPDATE reports SET issue_number=?,issue_node_id=?,issue_url=? WHERE id=?").bind(issue.number,issue.node_id,issue.html_url,row.id)]
    if(env.GITHUB_PROJECT_ID) statements.push(env.DB.prepare("INSERT OR IGNORE INTO outbox(id,report_id,kind,due_at,created_at) VALUES(?,?,'github_project',?,?)").bind(`${row.id}:github_project`,row.id,now(),now()))
    await env.DB.batch(statements); return String(issue.number)
  }
  if(job.kind==="github_project") {
    if(!row.issue_node_id||!env.GITHUB_PROJECT_ID) throw new DeliveryFailure("GitHub project setup required.",false,true)
    const result=await github(env,"/graphql",{method:"POST",body:JSON.stringify({query:"mutation($project:ID!,$content:ID!){addProjectV2ItemById(input:{projectId:$project,contentId:$content}){item{id}}}",variables:{project:env.GITHUB_PROJECT_ID,content:row.issue_node_id}})},send)
    if(result.errors) throw new DeliveryFailure("GitHub Project rejected the update. Check project permissions.",false,true)
    return "added"
  }
  if(job.kind!=="email_received"&&job.kind!=="email_resolved") throw new DeliveryFailure("Unknown delivery type.",false,true)
  if(!emailEnabled(env)) throw new DeliveryFailure("Email domain setup required.",false,true)
  if(job.kind==="email_resolved" && row.status!=="resolved") throw new DeliveryFailure("Report was reopened before its release email sent. Review before retrying.",false,true)
  if(!testerAllowed(env,row.email)) throw new DeliveryFailure('Beta recipient requires allowlist review.',false,true)
  return sendResend(env,job,JSON.stringify({to:[row.email],from:`0nlyType <${env.EMAIL_FROM}>`,reply_to:"hello@thedirectors.agency",...emailMessage(row,job.kind,env.SITE_URL)}),send)
}
export async function drain(env:Env,reportId?:string,send=fetch) {
  // A crashed send has an unknown remote outcome. Never blindly resend it.
  await env.DB.prepare("UPDATE outbox SET state='needs_review',last_error='Delivery lease expired; check the provider before retrying.',lease_token=NULL WHERE state='processing' AND lease_until<?").bind(now()).run()
  const cutoff=activationCutoff(env)
  await env.DB.prepare("UPDATE outbox SET state='held',last_error='Delivery activation or historical review required.' WHERE state='pending' AND (? IS NULL OR (reviewed_at IS NULL AND report_id IN (SELECT id FROM reports WHERE created_at<?)))").bind(cutoff,cutoff).run()
  if(cutoff===null) return {processed:0}
  const enabledKinds=[...(emailEnabled(env)?["email_received","email_resolved"]:[]),...(githubEnabled(env)?["github",...(env.GITHUB_PROJECT_ID?["github_project"]:[])]:[])]
  if(!enabledKinds.length) return {processed:0}
  // Disabled providers must not consume the batch window and starve enabled work.
  const jobs=await env.DB.prepare(`SELECT * FROM outbox WHERE state='pending' AND due_at<=? AND kind IN (${enabledKinds.map(()=>"?").join(",")}) ${reportId?"AND report_id=?":""} ORDER BY created_at,id LIMIT 20`).bind(now(),...enabledKinds,...(reportId?[reportId]:[])).all<Delivery>()
  let processed=0
  for(const job of jobs.results) {
    if(job.kind.startsWith("email")&&!emailEnabled(env) || job.kind.startsWith("github")&&!githubEnabled(env)) continue
    const lease=crypto.randomUUID()
    const claim=await env.DB.prepare("UPDATE outbox SET state='processing',attempts=attempts+1,lease_until=?,lease_token=? WHERE id=? AND state='pending' RETURNING id").bind(now()+300000,lease,job.id).first()
    if(!claim) continue
    processed++
    try {
      const provider=await deliver(env,job,await getReport(env,job.report_id),send)
      await env.DB.prepare("UPDATE outbox SET state='done',provider_id=?,lease_token=NULL,last_error=NULL WHERE id=? AND lease_token=?").bind(provider,job.id,lease).run()
    } catch(error) {
      const failure=error instanceof DeliveryFailure?error:new DeliveryFailure("Delivery could not be confirmed. Check provider status.",true)
      const review=!failure.quota&&(failure.ambiguous||failure.permanent||job.attempts>=7)
      await env.DB.prepare("UPDATE outbox SET state=?,last_error=?,due_at=?,lease_token=NULL,delivery_status=? WHERE id=? AND lease_token=?").bind(review?"needs_review":"pending",failure.reason,now()+(failure.quota?3600000:Math.min(86400000,60000*2**job.attempts)),failure.quota?'quota':failure.ambiguous?'uncertain':review?'failed':'queued',job.id,lease).run()
    }
  }
  return {processed}
}
