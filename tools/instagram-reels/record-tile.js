const {chromium}=require('playwright-core');const fs=require('fs');
(async()=>{const S=process.argv[2];const WORD=process.argv[3],SCENE=process.argv[4],DUR=+process.argv[5],OUT=process.argv[6];const shot=DUR===0;const SHIFT=+(process.argv[7]||0);const CFG=process.env.CFG?JSON.parse(process.env.CFG):null;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',args:['--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:432,height:768},deviceScaleFactor:2.5});
await ctx.route('**/video/*.mp4',r=>{const n=r.request().url().split('/').pop().replace('.mp4','.webm');r.fulfill({status:200,contentType:'video/webm',body:fs.readFileSync(S+'/webm/'+n)})});
await ctx.addInitScript(([sh,cfg])=>{window.__shift=sh;window.__cfg=cfg;document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.textContent=`
.site-header{display:none!important} body{padding-top:0!important}
.hero{min-height:768px!important;padding-top:98px!important;padding-bottom:0!important} .sub,.hero-cta,.hero-curve{display:none!important}
.hero-inner{display:flex!important;flex-direction:column!important} #phone{translate:0 -40px}
.stage{order:1!important;margin:0 0 0 0!important;--stage-h:362px!important;height:362px!important}
.hero-copy{order:2!important;width:100%!important;padding:0 0 0 28px!important;margin:6px 0 0!important}
h1.headline{order:3!important;text-align:left!important;font-size:96px!important;margin:96px 0 0!important;line-height:1!important;padding-left:4px!important;position:relative;z-index:5}
#reel-url{position:fixed;left:0;right:0;bottom:var(--url-b,16px);text-align:center;color:#fff;font:400 22px CooperBT,Georgia,serif;z-index:99}`;
const g=window.__cfg;if(g){if(g.urlTop!=null)st.textContent+=`#reel-url{top:${g.urlTop}px!important;bottom:auto!important}`;const pw=g.phone.w;st.textContent+=`#art-wrap{position:fixed!important;left:0!important;top:0!important;height:${g.art.h}px!important;transform:translate(${g.art.cx}px,${g.art.cy}px) translate(-50%,-50%) perspective(1400px) rotateY(${g.art.ry||0}deg) rotateX(${g.art.rx||0}deg) rotate(${g.art.rot}deg)!important;width:max-content!important;translate:none!important}
#phone{position:fixed!important;left:${g.phone.x}px!important;top:${g.phone.y}px!important;width:${pw}px!important;height:${Math.round(pw*2.025)}px!important;margin:0!important;translate:none!important;border-radius:${pw*0.19}px!important;padding:${pw*0.05}px!important}
.phone-screen{border-radius:${pw*0.152}px!important}.phone-notch{width:${pw*0.38}px!important;height:${pw*0.108}px!important;top:${pw*0.063}px!important;border-radius:${pw*0.07}px!important}
#scene-art{max-width:none!important}h1.headline{position:fixed!important;${g.text.align==='right'?`right:${g.text.x}px!important;left:auto!important;text-align:right!important;`:`left:${g.text.x}px!important;`}top:${g.text.y}px!important;font-size:${g.text.size}px!important;margin:0!important;padding:0!important;line-height:1!important;width:auto!important;white-space:nowrap}`;}else{st.textContent+=`#art-wrap{translate:${window.__shift}px 0}`;}document.head.appendChild(st);const u=document.createElement('div');u.id='reel-url';u.textContent='popcode.app';document.body.appendChild(u);});},[SHIFT,CFG]);
const p=await ctx.newPage();await p.goto('http://localhost:8765/index.html');await p.evaluate(()=>window.popcodeReel.pause());await p.waitForTimeout(2600);
await p.evaluate(({w,s})=>{window.popcodeReel.pause();const h=document.querySelector('h1.headline');h.textContent=w;h.setAttribute('aria-label',w);window.__scene=s;document.getElementById('art-wrap').classList.add('fading');document.getElementById('phone').classList.remove('playing');},{w:WORD,s:SCENE});
await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(1600);const GO=()=>p.evaluate(()=>window.popcodeReel.go(window.__scene));const OUTF=()=>p.evaluate(()=>{document.getElementById('art-wrap').classList.add('fading');document.getElementById('phone').classList.remove('playing');});
if(process.env.MEASURE){await GO();await p.waitForTimeout(3000);console.log(SCENE,JSON.stringify(await p.evaluate(()=>{const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return [Math.round(b.top),Math.round(b.bottom),Math.round(b.left),Math.round(b.right)]};const aw=document.getElementById('art-wrap');return {artH:aw.offsetHeight,artW:aw.offsetWidth,awBox:r('#art-wrap'),stage:r('.stage'),art:r('#scene-art'),phone:r('#phone'),h1:r('h1.headline')}})));await b.close();return;}
if(shot){await GO();for(const t of [600,5000]){await p.waitForTimeout(t===600?600:4400);await p.screenshot({path:`${S}/tile-${SCENE}-${t}.png`});}await b.close();return;}
const cdp=await ctx.newCDPSession(p);const dir=S+'/f-'+SCENE;fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir);
const list=[];let i=0;
cdp.on('Page.screencastFrame',async f=>{const n=String(i++).padStart(5,'0');fs.writeFileSync(`${dir}/${n}.jpg`,Buffer.from(f.data,'base64'));list.push([n,f.metadata.timestamp]);cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});});
await cdp.send('Page.startScreencast',{format:'jpeg',quality:92,maxWidth:1080,maxHeight:1920,everyNthFrame:1});
await p.waitForTimeout(400);await GO();await p.waitForTimeout(DUR);await OUTF();await p.waitForTimeout(1300);await cdp.send('Page.stopScreencast');await p.waitForTimeout(300);
let txt='';for(let k=0;k<list.length;k++){const d=k+1<list.length?list[k+1][1]-list[k][1]:1/30;txt+=`file '${dir}/${list[k][0]}.jpg'\nduration ${d.toFixed(4)}\n`;}
txt+=`file '${dir}/${list[list.length-1][0]}.jpg'\n`;fs.writeFileSync(`${S}/${OUT}.txt`,txt);console.log(SCENE,'frames',list.length);
await b.close()})();
