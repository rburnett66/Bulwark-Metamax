/**
 * src/menu/missionLogCss.js — the Mission Log's styles, lifted from the design page
 * (docs/16 Bulwark MM/design/mission-log/mission-log.src.html) with every selector scoped under .bwm-ml, so its .row, .btn
 * and .tab can never touch the rest of the menu. The tokens are the page's own. Change the look here; the design page is
 * the reference it was taken from. [MM-story_mvyqoo07_f]
 */
export const MISSION_LOG_CSS = String.raw`
.bwm-ml{position:absolute;inset:0;z-index:30;pointer-events:none;color:var(--text);font:14px/1.45 var(--f-ui);-webkit-font-smoothing:antialiased;--ink:#0c0e12; --ink2:#14181f; --panel:#1a1f28; --panel-hi:#20262f; --well:#0f1217; --line:#2e3846; --line2:#232a34; --line3:#3e4a5a; --text:#e6ecf3; --dim:#8fa0b3; --dimmer:#5c6a7a; --gold:#f2c869; --gold2:#d9a441; --cyan:#7af0ff; --cyan2:#34e1ff; --cyan3:#2aa8d8; --s-new:#34e1ff; --s-active:#f2c869; --s-risk:#ff8a3d; --s-ready:#5fe39a; --s-failed:#ef5350; --s-done:#7b8898; --s-locked:#566273; --r-common:#5aa8f0; --r-uncommon:#f2c84a; --r-rare:#e85050; --r-epic:#52c070; --f-ui:"Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif;}
.bwm-ml *{box-sizing:border-box;margin:0;padding:0}
.bwm-ml button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.bwm-ml button:focus-visible,.bwm-ml [tabindex]:focus-visible{outline:2px solid var(--cyan2);outline-offset:2px}
.bwm-ml svg.i{width:1em;height:1em;flex:none;display:block}
.bwm-ml .num{font-variant-numeric:tabular-nums}
.bwm-ml .stale{padding:40px 20px;text-align:center;color:var(--s-failed);font-size:13px}
.bwm-ml .toast{position:absolute;z-index:40;top:84px;right:30px;width:min(380px,calc(100vw - 32px));display:flex;gap:12px;align-items:center; padding:12px 14px 12px 12px;background:linear-gradient(180deg,#18202a,#10141a);border:1px solid var(--s-new); box-shadow:0 0 30px -8px rgba(52,225,255,.55),0 20px 40px rgba(0,0,0,.6);transform:translateY(-12px);opacity:0;pointer-events:none; transition:transform .35s cubic-bezier(.2,.8,.2,1),opacity .35s}
.bwm-ml .toast.on{transform:none;opacity:1;pointer-events:auto}
.bwm-ml .toast .tt{flex:1;min-width:0}
.bwm-ml .toast .k,.bwm-ml .toast .n,.bwm-ml .toast .g{display:block}
.bwm-ml .toast .k{font-size:9px;letter-spacing:.3em;color:var(--s-new);font-weight:800}
.bwm-ml .toast .n{font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bwm-ml .toast .g{font-size:12px;color:var(--dim)}
.bwm-ml .toast .bar{margin-top:7px}
@media (max-height:500px){.bwm-ml .toast{top:54px;right:14px}}
.bwm-ml .log{position:absolute;z-index:30;left:30px;right:30px;top:92px;bottom:58px;display:grid;grid-template-columns:minmax(340px,440px) 1fr; background:rgba(10,12,16,.94);border:1px solid var(--line);box-shadow:0 0 0 1px rgba(242,200,105,.12),0 40px 80px rgba(0,0,0,.7); opacity:0;transform:translateY(10px) scale(.99);pointer-events:none;transition:opacity .28s,transform .28s cubic-bezier(.2,.8,.2,1)}
.bwm-ml .log.on{opacity:1;transform:none;pointer-events:auto}
.bwm-ml .log::before{content:"";position:absolute;left:-1px;top:-1px;width:120px;height:2px;background:var(--gold)}
.bwm-ml .log::after{content:"";position:absolute;right:-1px;bottom:-1px;width:120px;height:2px;background:var(--gold)}
.bwm-ml .lp{display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--line2)}
.bwm-ml .lp-head{display:flex;align-items:center;gap:12px;padding:18px 20px 12px}
.bwm-ml .lp-head h1{font-size:22px;font-weight:900;letter-spacing:.24em}
.bwm-ml .lp-head .sum{margin-left:auto;font-size:11px;color:var(--dim);letter-spacing:.12em;text-align:right}
.bwm-ml .lp-head .sum b{color:var(--text)}
.bwm-ml .lp-head .x{display:none}
.bwm-ml .tabs{display:flex;gap:2px;padding:0 20px 12px}
.bwm-ml .tab{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;height:34px;font-size:10px;font-weight:800;letter-spacing:.18em; text-transform:uppercase;color:var(--dim);background:var(--well);border:1px solid var(--line2)}
.bwm-ml .tab b{font-size:11px;color:var(--text);font-weight:800}
.bwm-ml .tab[aria-selected=true]{color:var(--ink);background:var(--gold);border-color:var(--gold)}
.bwm-ml .tab[aria-selected=true] b{color:var(--ink)}
.bwm-ml .tab .dot{width:7px;height:7px;background:var(--s-ready);clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)}
.bwm-ml .list{flex:1;overflow-y:auto;padding:0 12px 14px 20px;scrollbar-width:thin;scrollbar-color:var(--line) transparent}
.bwm-ml .grp{font-size:10px;letter-spacing:.26em;color:var(--dimmer);font-weight:800;padding:12px 0 6px;display:flex;align-items:center;gap:10px}
.bwm-ml .grp::after{content:"";flex:1;height:1px;background:var(--line2)}
.bwm-ml .row{--sc:var(--s-active);position:relative;display:grid;grid-template-columns:44px 1fr auto;grid-template-rows:auto auto;column-gap:12px;row-gap:7px; width:100%;text-align:left;padding:11px 12px 11px 10px;margin-bottom:6px;background:linear-gradient(90deg,rgba(26,31,40,.95),rgba(20,24,31,.9)); border:1px solid var(--line2);border-left:3px solid var(--sc);transition:background .15s,border-color .15s}
.bwm-ml .row:hover{background:var(--panel-hi);border-color:var(--line3);border-left-color:var(--sc)}
.bwm-ml .row[aria-selected=true]{background:linear-gradient(90deg,color-mix(in srgb,var(--sc) 14%,#1a1f28),#1a1f28);border-color:color-mix(in srgb,var(--sc) 45%,#2e3846);border-left-color:var(--sc)}
.bwm-ml .row[aria-selected=true]::after{content:"";position:absolute;right:-13px;top:50%;width:10px;height:10px;margin-top:-5px;background:var(--sc); clip-path:polygon(0 0,100% 50%,0 100%)}
.bwm-ml .row.st-done,.bwm-ml .row.st-failed{background:rgba(18,21,27,.85)}
.bwm-ml .row.st-done .title,.bwm-ml .row.st-failed .title{color:#b4bfcc}
.bwm-ml .badge{grid-row:1 / span 2;align-self:center;position:relative;width:44px;height:48px;display:grid;place-items:center;color:var(--sc)}
.bwm-ml .badge::before{content:"";position:absolute;inset:0;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); background:linear-gradient(160deg,color-mix(in srgb,var(--sc) 26%,#11151b),#0c0f14)}
.bwm-ml .badge::after{content:"";position:absolute;inset:0;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%,0 25%,2px 26%,2px 74%,50% 97.5%,calc(100% - 2px) 74%,calc(100% - 2px) 26%,50% 2.5%,2px 26%,0 25%); background:var(--sc);opacity:.75}
.bwm-ml .badge svg{position:relative;width:22px;height:22px}
.bwm-ml .st-done .badge{color:#9aa6b4}
.bwm-ml .mid{min-width:0;display:block}
.bwm-ml .title{display:block;font-weight:800;font-size:14.5px;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bwm-ml .sub{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden}
.bwm-ml .sub .fi{width:13px;height:13px;color:var(--fc)}
.bwm-ml .sub span{overflow:hidden;text-overflow:ellipsis}
.bwm-ml .right{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.bwm-ml .rw{display:flex;gap:3px}
.bwm-ml .rwi{position:relative;width:24px;height:24px;display:grid;place-items:center;background:var(--well);border:1px solid var(--line2);color:var(--rc,var(--text))}
.bwm-ml .rwi svg{width:15px;height:15px}
.bwm-ml .rwi.more{width:auto;padding:0 5px;font-size:10px;font-weight:800;color:var(--dim)}
.bwm-ml .prow{grid-column:2 / span 2;display:flex;align-items:center;gap:10px}
.bwm-ml .prow .bar{flex:1}
.bwm-ml .prow .pct{font-size:11px;font-weight:800;min-width:46px;text-align:right;color:var(--sc)}
.bwm-ml .st-done .prow .pct{color:var(--dim)}
.bwm-ml .tag{display:inline-flex;align-items:center;gap:5px;height:18px;padding:0 6px 0 5px;font-size:9px;font-weight:900;letter-spacing:.16em;text-transform:uppercase; color:var(--sc);background:color-mix(in srgb,var(--sc) 13%,transparent);border:1px solid color-mix(in srgb,var(--sc) 45%,transparent);white-space:nowrap}
.bwm-ml .tag svg{width:10px;height:10px}
.bwm-ml .st-new .tag svg{animation:blink 1.6s ease-in-out infinite}
@keyframes blink{50%{opacity:.35}}
.bwm-ml .st-ready .tag{color:var(--ink);background:var(--s-ready);border-color:var(--s-ready);box-shadow:0 0 12px rgba(95,227,154,.45)}
.bwm-ml .bar{--sc:var(--s-active);position:relative;height:8px;display:flex;gap:2px}
.bwm-ml .bar .seg{flex:1;background:#0b0e13;border:1px solid var(--line2);position:relative;overflow:hidden}
.bwm-ml .bar .seg.f{background:var(--sc);border-color:var(--sc);box-shadow:0 0 6px color-mix(in srgb,var(--sc) 55%,transparent)}
.bwm-ml .bar.cont{display:block;background:#0b0e13;border:1px solid var(--line2)}
.bwm-ml .bar.cont .fill{position:absolute;left:0;top:0;bottom:0;background:var(--sc);box-shadow:0 0 8px color-mix(in srgb,var(--sc) 55%,transparent)}
.bwm-ml .bar.cont .tick{position:absolute;top:-1px;bottom:-1px;width:1px;background:rgba(12,14,18,.9)}
.bwm-ml .bar.st-ready .seg.f,.bwm-ml .bar.st-ready .fill{background:linear-gradient(90deg,var(--s-ready),#b8ffd6,var(--s-ready));background-size:300% 100%;animation:sweep 2.4s linear infinite}
@keyframes sweep{from{background-position:100% 0}to{background-position:-200% 0}}
.bwm-ml .bar.st-risk .seg.f,.bwm-ml .bar.st-risk .fill{background:repeating-linear-gradient(-45deg,var(--s-risk) 0 5px,#c4581c 5px 9px)}
.bwm-ml .bar.st-failed .seg:not(.f){background:repeating-linear-gradient(-45deg,rgba(239,83,80,.22) 0 2px,transparent 2px 5px);border-color:rgba(239,83,80,.35)}
.bwm-ml .bar.st-failed .seg.f,.bwm-ml .bar.st-failed .fill{background:#7d2d2c;border-color:#7d2d2c;box-shadow:none}
.bwm-ml .bar.st-done .seg.f,.bwm-ml .bar.st-done .fill{background:#566170;border-color:#566170;box-shadow:none}
.bwm-ml .bar.big{height:12px;gap:3px}
@media (prefers-reduced-motion:reduce){.bwm-ml *{animation:none!important;transition:none!important}}
.bwm-ml .dp{position:relative;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--line) transparent}
.bwm-ml .dossier{--sc:var(--s-active);--fc:var(--gold);display:grid;grid-template-columns:1fr 250px;gap:0;min-height:100%}
@media (min-width:981px),(max-height:500px) and (min-width:701px){.bwm-ml .dp{overflow:hidden}
.bwm-ml .dossier{height:100%}
.bwm-ml .dmain,.bwm-ml .dside{overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--line) transparent}
.bwm-ml .actions{position:sticky;bottom:0;background:linear-gradient(180deg,rgba(14,17,22,0),rgba(14,17,22,.97) 22%);padding-top:22px}}
.bwm-ml .dmain{padding:22px 28px 28px;min-width:0}
.bwm-ml .dside{border-left:1px solid var(--line2);background:linear-gradient(180deg,rgba(20,24,31,.6),rgba(12,14,18,.6));display:flex;flex-direction:column}
.bwm-ml .dback{display:none}
.bwm-ml .dk{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.bwm-ml .dk .type{display:flex;align-items:center;gap:7px;font-size:10px;font-weight:900;letter-spacing:.26em;text-transform:uppercase;color:var(--sc)}
.bwm-ml .dk .type svg{width:16px;height:16px}
.bwm-ml .dk .where{font-size:11px;letter-spacing:.16em;color:var(--dim);text-transform:uppercase}
.bwm-ml .dtitle{font-size:34px;line-height:1.05;font-weight:900;letter-spacing:.01em;margin:10px 0 6px;text-wrap:balance}
.bwm-ml .dprog{display:flex;align-items:center;gap:14px;margin:16px 0 4px}
.bwm-ml .dprog .bar{flex:1}
.bwm-ml .dprog .pct{font-size:22px;font-weight:900;color:var(--sc);min-width:70px;text-align:right}
.bwm-ml .dprog .pct small{font-size:12px;color:var(--dim);font-weight:700}
.bwm-ml .dnote{font-size:12px;color:var(--sc);display:flex;gap:6px;align-items:center;min-height:18px}
.bwm-ml .dnote svg{width:12px;height:12px}
.bwm-ml .brief{margin:18px 0 6px;padding:14px 16px 14px 18px;background:var(--well);border:1px solid var(--line2);border-left:3px solid var(--fc);font-size:14px;color:#c9d3de;max-width:68ch}
.bwm-ml .brief q{display:block;font-style:italic;color:var(--text);quotes:"\201C" "\201D"}
.bwm-ml .brief .who{margin-top:8px;font-size:11px;letter-spacing:.14em;color:var(--dim);text-transform:uppercase}
.bwm-ml .sec{margin-top:22px}
.bwm-ml .sec h3{font-size:10px;letter-spacing:.3em;color:var(--dim);font-weight:900;margin-bottom:9px;display:flex;gap:10px;align-items:center}
.bwm-ml .sec h3::after{content:"";flex:1;height:1px;background:var(--line2)}
.bwm-ml .obj{display:grid;grid-template-columns:22px 1fr 150px 76px;align-items:center;gap:10px;padding:9px 12px;background:rgba(20,24,31,.7);border:1px solid var(--line2);margin-bottom:4px}
.bwm-ml .obj .ck{width:18px;height:18px;color:var(--dimmer)}
.bwm-ml .obj.ok .ck{color:var(--s-ready)}
.bwm-ml .obj.bad .ck{color:var(--s-failed)}
.bwm-ml .obj .ot{font-size:13.5px}
.bwm-ml .obj.ok .ot{color:#cfe9da}
.bwm-ml .obj .oc{font-size:12px;font-weight:800;text-align:right;white-space:nowrap}
.bwm-ml .obj.opt .ot::after{content:"Bonus";margin-left:8px;font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);border:1px solid rgba(242,200,105,.4);padding:1px 5px;vertical-align:2px}
.bwm-ml .items{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px}
.bwm-ml .item{--rc:var(--r-common);display:flex;gap:10px;align-items:center;padding:9px 10px;background:var(--well);border:1px solid var(--line2);border-left:3px solid var(--rc)}
.bwm-ml .item .gem{width:34px;height:34px;display:grid;place-items:center;color:var(--rc);background:radial-gradient(circle at 50% 60%,color-mix(in srgb,var(--rc) 28%,transparent),transparent 70%)}
.bwm-ml .item .gem svg{width:24px;height:24px}
.bwm-ml .item b{display:block;font-size:13px;white-space:nowrap}
.bwm-ml .item small{white-space:nowrap}
.bwm-ml .item small{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--rc);font-weight:800}
.bwm-ml .item .have{margin-left:auto;font-size:13px;font-weight:800;text-align:right;white-space:nowrap}
.bwm-ml .rewards{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:6px}
.bwm-ml .rwd{--rc:var(--gold);position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 8px 10px;background:linear-gradient(180deg,#171c24,#10141a);border:1px solid var(--line2);text-align:center}
.bwm-ml .rwd::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:var(--rc);opacity:.85}
.bwm-ml .rwd .ri{width:40px;height:40px;display:grid;place-items:center;color:var(--rc);filter:drop-shadow(0 0 8px color-mix(in srgb,var(--rc) 45%,transparent))}
.bwm-ml .rwd .ri svg{width:30px;height:30px}
.bwm-ml .rwd b{font-size:18px;font-weight:900}
.bwm-ml .rwd small{font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim)}
.bwm-ml .rwd.neg{--rc:var(--s-failed)}
.bwm-ml .rwd.neg b{color:var(--s-failed)}
.bwm-ml .st-done .rwd{opacity:.6}
.bwm-ml .terms{display:flex;flex-direction:column;gap:5px;font-size:12.5px;color:var(--dim)}
.bwm-ml .terms div{display:flex;gap:8px;align-items:baseline}
.bwm-ml .terms b{color:var(--text);font-weight:700}
.bwm-ml .terms .neg{color:var(--s-failed);font-weight:800}
.bwm-ml .giver{padding:20px 18px 16px}
.bwm-ml .pframe{position:relative;width:100%;aspect-ratio:3/4;background:#0b0e13; clip-path:polygon(0 0,100% 0,100% calc(100% - 18px),calc(100% - 18px) 100%,0 100%)}
.bwm-ml .pframe img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 12%}
.bwm-ml .pframe .sil{position:absolute;inset:0;display:grid;place-items:end center;background:radial-gradient(circle at 50% 35%,rgba(160,120,255,.25),transparent 60%),#0b0d12;color:#1d1830}
.bwm-ml .pframe .sil svg{width:82%;height:auto;fill:#08070c;stroke:rgba(170,140,255,.35);stroke-width:.6}
.bwm-ml .pframe::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(10,12,16,.95));pointer-events:none}
.bwm-ml .pframe .edge{position:absolute;inset:0;border:1px solid var(--fc);opacity:.6;pointer-events:none}
.bwm-ml .pframe .fbadge{position:absolute;left:10px;bottom:10px;z-index:2;display:flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.2em;font-weight:900;color:var(--fc);text-transform:uppercase}
.bwm-ml .pframe .fbadge svg{width:18px;height:18px}
.bwm-ml .gname{font-size:17px;font-weight:900;line-height:1.15;margin-top:12px}
.bwm-ml .grole{font-size:11px;color:var(--dim);margin-top:3px;letter-spacing:.04em}
.bwm-ml .gmot{font-size:12px;color:#b9c4d0;font-style:italic;margin-top:8px;border-left:2px solid var(--line3);padding-left:8px}
.bwm-ml .facts{margin:14px 18px 0;display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:11.5px}
.bwm-ml .facts dt{color:var(--dimmer);letter-spacing:.16em;text-transform:uppercase;font-size:9.5px;font-weight:800;padding-top:2px}
.bwm-ml .facts dd{color:var(--text);font-weight:700;display:flex;align-items:center;gap:6px}
.bwm-ml .facts dd svg{width:13px;height:13px;color:var(--fc)}
.bwm-ml .align{margin:16px 18px 0}
.bwm-ml .align .al-h{display:flex;justify-content:space-between;font-size:9.5px;letter-spacing:.16em;color:var(--dimmer);font-weight:800;text-transform:uppercase}
.bwm-ml .rail{display:grid;grid-template-columns:repeat(9,1fr);gap:2px;margin:6px 0 4px}
.bwm-ml .rail i{height:8px;background:var(--c);opacity:.28}
.bwm-ml .rail i.on{opacity:1;height:12px;margin-top:-2px;box-shadow:0 0 10px var(--c)}
.bwm-ml .rail-codes{display:grid;grid-template-columns:repeat(9,1fr);font-size:8.5px;text-align:center;color:var(--dimmer);font-weight:800}
.bwm-ml .rail-codes .on{color:var(--text)}
.bwm-ml .align .al-n{margin-top:8px;font-size:13px;font-weight:800}
.bwm-ml .align .al-n small{display:block;font-size:10.5px;color:var(--dim);font-weight:600;margin-top:2px}
.bwm-ml .loy{margin:16px 18px 0;padding:10px 12px;background:var(--well);border:1px solid var(--line2)}
.bwm-ml .loy .lh{display:flex;justify-content:space-between;font-size:10px;letter-spacing:.16em;color:var(--dim);font-weight:800;text-transform:uppercase}
.bwm-ml .loy .lh b{color:var(--text)}
.bwm-ml .loy .lb{position:relative;height:6px;background:#0b0e13;border:1px solid var(--line2);margin-top:7px}
.bwm-ml .loy .lb span{position:absolute;left:0;top:0;bottom:0;background:var(--fc)}
.bwm-ml .loy .lb em{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(-45deg,var(--fc) 0 3px,transparent 3px 6px);opacity:.7}
.bwm-ml .loy .lb i{position:absolute;top:-3px;bottom:-3px;width:1px;background:var(--dim)}
.bwm-ml .loy .lt{display:flex;justify-content:space-between;font-size:9px;color:var(--dimmer);margin-top:4px;letter-spacing:.08em}
.bwm-ml .actions{margin-top:auto;padding:16px 18px 18px;display:flex;flex-direction:column;gap:6px}
.bwm-ml .btn{height:44px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px;font-weight:900;letter-spacing:.2em;text-transform:uppercase; background:var(--panel);border:1px solid var(--line)}
.bwm-ml .btn:hover{border-color:var(--gold2);background:var(--panel-hi)}
.bwm-ml .btn svg{width:16px;height:16px}
.bwm-ml .btn.primary{color:var(--ink);background:linear-gradient(180deg,var(--gold),var(--gold2));border-color:var(--gold);box-shadow:0 0 22px rgba(242,200,105,.35)}
.bwm-ml .btn.claim{color:#06130c;background:linear-gradient(180deg,#8ff3bb,var(--s-ready));border-color:var(--s-ready);box-shadow:0 0 26px rgba(95,227,154,.5);height:52px;font-size:13px}
.bwm-ml .btn.claim:hover{filter:brightness(1.08)}
.bwm-ml .btn.ghost{background:transparent;color:var(--dim);height:36px;font-size:10.5px}
.bwm-ml .btn.ghost:hover{color:var(--s-failed);border-color:rgba(239,83,80,.5)}
.bwm-ml .btn[aria-pressed=true]{border-color:var(--s-new);color:var(--s-new)}
.bwm-ml .claimed-stamp{display:flex;align-items:center;justify-content:center;gap:8px;height:44px;font-size:11px;letter-spacing:.2em;font-weight:900;color:var(--s-done);border:1px dashed #44505e;text-transform:uppercase}
.bwm-ml .claimed-stamp svg{width:16px;height:16px}
.bwm-ml .burst{position:absolute;inset:0;pointer-events:none;display:grid;place-items:center;z-index:5}
.bwm-ml .burst span{position:absolute;width:12px;height:12px;background:var(--s-ready);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);opacity:0;animation:fly 1s cubic-bezier(.2,.7,.3,1) forwards}
@keyframes fly{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--x),var(--y)) scale(.3)}}
.bwm-ml .empty{padding:40px 20px;text-align:center;color:var(--dim);font-size:13px}
.bwm-ml .empty svg{width:40px;height:40px;color:var(--dimmer);margin:0 auto 10px}
@media (max-width:1180px){.bwm-ml .dossier{grid-template-columns:1fr 220px}
.bwm-ml .dtitle{font-size:28px}
.bwm-ml .obj{grid-template-columns:22px 1fr 110px 50px}}
@media (max-width:980px){.bwm-ml .log{grid-template-columns:minmax(300px,360px) 1fr}
.bwm-ml .dossier{grid-template-columns:1fr}
.bwm-ml .dside{border-left:0;border-top:1px solid var(--line2)}
.bwm-ml .giver{display:grid;grid-template-columns:110px 1fr;gap:14px;align-items:start}
.bwm-ml .gname{margin-top:0}}
@media (max-height:500px){.bwm-ml .log{left:10px;right:10px;top:58px;bottom:44px;grid-template-columns:minmax(280px,330px) 1fr}
.bwm-ml .lp-head{padding:10px 12px 8px}
.bwm-ml .lp-head h1{font-size:16px}
.bwm-ml .tabs{padding:0 12px 8px}
.bwm-ml .tab{height:28px;font-size:9px;letter-spacing:.1em}
.bwm-ml .list{padding:0 8px 10px 12px}
.bwm-ml .row{padding:8px 9px 8px 7px;grid-template-columns:36px 1fr auto;row-gap:5px}
.bwm-ml .badge{width:36px;height:40px}
.bwm-ml .badge svg{width:18px;height:18px}
.bwm-ml .title{font-size:13px}
.bwm-ml .rwi{width:20px;height:20px}
.bwm-ml .rwi svg{width:12px;height:12px}
.bwm-ml .grp{padding:8px 0 4px}
.bwm-ml .dossier{grid-template-columns:1fr 190px}
.bwm-ml .dmain{padding:12px 16px 18px}
.bwm-ml .dtitle{font-size:22px;margin:6px 0 2px}
.bwm-ml .dprog{margin:8px 0 2px}
.bwm-ml .dprog .pct{font-size:17px}
.bwm-ml .brief{margin-top:10px;padding:10px 12px;font-size:13px}
.bwm-ml .sec{margin-top:14px}
.bwm-ml .obj{grid-template-columns:20px 1fr 80px 46px;padding:7px 10px}
.bwm-ml .rwd{padding:10px 6px 8px}
.bwm-ml .rwd .ri{width:30px;height:30px}
.bwm-ml .rwd .ri svg{width:24px;height:24px}
.bwm-ml .rwd b{font-size:15px}
.bwm-ml .dside{border-left:1px solid var(--line2);border-top:0}
.bwm-ml .giver{display:block;padding:12px 12px 8px}
.bwm-ml .pframe{aspect-ratio:4/3}
.bwm-ml .gname{font-size:14px;margin-top:8px}
.bwm-ml .gmot{display:none}
.bwm-ml .facts,.bwm-ml .align,.bwm-ml .loy{margin-left:12px;margin-right:12px}
.bwm-ml .actions{padding:10px 12px 12px}
.bwm-ml .btn{height:36px;letter-spacing:.12em;font-size:11px}
.bwm-ml .btn.claim{height:40px}
.bwm-ml .btn.ghost{height:26px;font-size:9.5px}
.bwm-ml .actions{gap:4px}}
@media (max-width:700px){.bwm-ml .log{grid-template-columns:1fr;left:8px;right:8px}
.bwm-ml .dp{position:absolute;inset:0;background:var(--ink);transform:translateX(100%);transition:transform .3s cubic-bezier(.2,.8,.2,1);z-index:3}
.bwm-ml .log.detail .dp{transform:none}
.bwm-ml .dback{display:flex;align-items:center;gap:8px;padding:12px 16px;font-size:11px;font-weight:800;letter-spacing:.2em;color:var(--dim);border-bottom:1px solid var(--line2);width:100%;text-transform:uppercase}
.bwm-ml .dback svg{width:14px;height:14px}
.bwm-ml .dossier{grid-template-columns:1fr}
.bwm-ml .row[aria-selected=true]::after{display:none}
.bwm-ml .giver{display:grid;grid-template-columns:96px 1fr;gap:12px}
.bwm-ml .dtitle{font-size:24px}
.bwm-ml .obj{grid-template-columns:20px 1fr 54px}
.bwm-ml .obj .bar{display:none}}
.bwm-ml .kick{display:flex;flex-wrap:nowrap;overflow:hidden;align-items:center;gap:7px;font-size:8.5px;font-weight:900;letter-spacing:.2em;text-transform:uppercase;color:var(--dim);margin-bottom:2px;white-space:nowrap}
.bwm-ml .kick .role{color:var(--gold)}
.bwm-ml .kick .role.r2{color:#b9c6d6}
.bwm-ml .kick .var-l{color:#7fe0b0}
.bwm-ml .kick .var-s{color:#c99be8}
.bwm-ml .kick .stp{color:var(--dimmer)}
.bwm-ml .row.st-locked{background:rgba(18,21,27,.7);border-style:dashed;border-left-style:solid}
.bwm-ml .row.st-locked .title{color:#9aa6b4}
.bwm-ml .qline{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--dim);letter-spacing:.06em}
.bwm-ml .qline svg{width:14px;height:14px;color:var(--gold)}
.bwm-ml .gates{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px}
.bwm-ml .gate{display:flex;gap:9px;align-items:center;padding:9px 11px;background:var(--well);border:1px solid var(--line2);font-size:12.5px}
.bwm-ml .gate svg{width:16px;height:16px;flex:none}
.bwm-ml .gate.ok svg{color:var(--s-ready)}
.bwm-ml .gate.no{border-color:rgba(255,138,61,.35)}
.bwm-ml .gate.no svg{color:var(--s-risk)}
.bwm-ml .gate small{display:block;font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim);font-weight:800}
.bwm-ml .impact{display:flex;gap:6px;flex-wrap:wrap}
.bwm-ml .imp{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--well);border:1px solid var(--line2);border-left:3px solid var(--ic);font-size:12.5px}
.bwm-ml .imp b{font-size:16px;font-weight:900;color:var(--ic)}
.bwm-ml .imp svg{width:16px;height:16px;color:var(--ic)}
.bwm-ml .shipnote{font-size:11px;color:var(--dim);text-align:center;line-height:1.35;margin-top:2px}
.bwm-ml .shipnote b{color:var(--text)}
.bwm-ml .inv::before,.bwm-ml .inv::after{background:var(--cyan2)}
.bwm-ml .log.inv{grid-template-columns:1fr 300px}
.bwm-ml .inv .lp{border-right:1px solid var(--line2)}
.bwm-ml .pband{--fc:#888;margin:0 0 10px;background:rgba(18,22,28,.6);border:1px solid var(--line2);border-left:3px solid var(--fc)}
.bwm-ml .pband header{display:flex;align-items:center;gap:9px;padding:9px 12px;border-bottom:1px solid var(--line2)}
.bwm-ml .pband header > svg{width:18px;height:18px;color:var(--fc)}
.bwm-ml .pband header b{font-size:14px;font-weight:900}
.bwm-ml .pband header small{font-size:11px;color:var(--dim)}
.bwm-ml .pbt{margin-left:auto;font-size:11px;color:var(--dim);display:flex;align-items:center;gap:5px}
.bwm-ml .pbt b{color:var(--text);font-size:13px}
.bwm-ml .pbt em{font-style:normal;color:var(--cyan2);font-weight:800}
.bwm-ml .pbt svg{width:11px;height:11px}
.bwm-ml .pband.locked{opacity:.55}
.bwm-ml .rts{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line2)}
.bwm-ml .rt{--rc:#888;display:grid;grid-template-columns:30px 1fr auto;align-items:center;gap:9px;padding:10px 12px;background:#12161d;text-align:left;border-top:2px solid var(--rc)}
.bwm-ml .rt:hover{background:var(--panel-hi)}
.bwm-ml .rt[aria-selected=true]{background:color-mix(in srgb,var(--rc) 14%,#151a22);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--rc) 55%,transparent)}
.bwm-ml .rt .gem3{width:28px;height:28px;color:var(--rc);filter:drop-shadow(0 0 6px color-mix(in srgb,var(--rc) 45%,transparent))}
.bwm-ml .rtx{min-width:0}
.bwm-ml .rtx b{display:block;font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bwm-ml .rtx small{font-size:9px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:var(--rc)}
.bwm-ml .rtn{font-size:18px;font-weight:900;text-align:right;display:flex;flex-direction:column;align-items:flex-end;line-height:1.05}
.bwm-ml .rtn em{font-style:normal;font-size:10px;color:var(--cyan2)}
.bwm-ml .rt.zero .rtn{color:var(--dimmer)}
.bwm-ml .rdet{--rc:#888;padding:22px 20px;border-top:3px solid var(--rc);min-height:100%}
.bwm-ml .rdet .gem2{display:block;width:64px;height:64px;color:var(--rc);filter:drop-shadow(0 0 14px color-mix(in srgb,var(--rc) 55%,transparent))}
.bwm-ml .rdet .gem2 svg{width:64px;height:64px}
.bwm-ml .rdn{font-size:40px;font-weight:900;margin-top:10px;line-height:1}
.bwm-ml .rdnew{font-size:11px;color:var(--cyan2);font-weight:800;margin-top:4px}
.bwm-ml .rdet h2{font-size:22px;font-weight:900;margin-top:12px}
.bwm-ml .rdt{font-size:10px;letter-spacing:.2em;text-transform:uppercase;font-weight:900;color:var(--rc)}
.bwm-ml .rdet dl{display:grid;grid-template-columns:auto 1fr;gap:7px 12px;margin-top:16px;font-size:12.5px;color:#c3cdd8}
.bwm-ml .rdet dt{color:var(--dimmer);text-transform:uppercase;letter-spacing:.14em;font-size:9.5px;font-weight:800;padding-top:3px}
.bwm-ml .rdet dd{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.bwm-ml .rdet dd svg{width:13px;height:13px;color:var(--fc)}
@media (max-width:1180px){.bwm-ml .rts{grid-template-columns:repeat(2,1fr)}}
@media (max-height:500px){.bwm-ml .log.inv{grid-template-columns:1fr 210px}
.bwm-ml .rts{grid-template-columns:repeat(4,1fr)}
.bwm-ml .rt{grid-template-columns:22px 1fr auto;padding:6px 8px;gap:6px}
.bwm-ml .rt .gem3{width:20px;height:20px}
.bwm-ml .rtx b{font-size:11px}
.bwm-ml .rtn{font-size:14px}
.bwm-ml .pband header{padding:5px 10px}
.bwm-ml .rdet{padding:12px}
.bwm-ml .rdet .gem2,.bwm-ml .rdet .gem2 svg{width:36px;height:36px}
.bwm-ml .rdn{font-size:26px}
.bwm-ml .rdet h2{font-size:16px}
.bwm-ml .rdet .inote{display:none}
.bwm-ml .rdet dl{margin-top:8px;font-size:11px}}
@media (max-width:700px){.bwm-ml .log.inv{grid-template-columns:1fr}
.bwm-ml .rts{grid-template-columns:1fr 1fr}}
.bwm-ml .prow2{--fc:#888;display:grid;grid-template-columns:24px 1fr auto;align-items:center;gap:11px;width:100%;text-align:left;padding:10px 12px 10px 11px;margin-bottom:5px; background:linear-gradient(90deg,rgba(26,31,40,.95),rgba(20,24,31,.9));border:1px solid var(--line2);border-left:3px solid var(--fc)}
.bwm-ml .prow2:hover{background:var(--panel-hi)}
.bwm-ml .prow2 > svg{width:20px;height:20px;color:var(--fc)}
.bwm-ml .prow2 b{font-size:14px;font-weight:800;display:block}
.bwm-ml .prow2 small{display:block;font-size:11px;color:var(--dim)}
.bwm-ml .prow2 .tot{font-size:14px;font-weight:900;display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.bwm-ml .prow2 .tot svg{width:12px;height:12px;color:var(--dimmer)}
.bwm-ml .prow2 .nw{font-style:normal;font-size:10px;color:var(--cyan2)}
.bwm-ml .prow2[aria-selected=true]{background:linear-gradient(90deg,color-mix(in srgb,var(--fc) 16%,#1a1f28),#1a1f28);border-color:color-mix(in srgb,var(--fc) 45%,#2e3846);border-left-color:var(--fc)}
.bwm-ml .prow2.locked{opacity:.55}
.bwm-ml .pips{display:flex;gap:3px;margin-top:5px}
.bwm-ml .pips i{width:18px;height:4px;background:var(--c);opacity:.22}
.bwm-ml .pips i.on{opacity:1}
.bwm-ml .ipane{padding:22px 28px 28px}
.bwm-ml .ihead{display:flex;align-items:center;gap:14px}
.bwm-ml .ihead > svg{width:40px;height:40px;color:var(--fc)}
.bwm-ml .ihead .pl{font-size:32px;font-weight:900;line-height:1}
.bwm-ml .ihead .fx{font-size:12px;color:var(--dim);margin-top:4px}
.bwm-ml .ihtot{margin-left:auto;text-align:right}
.bwm-ml .ihtot b{display:block;font-size:28px;font-weight:900;color:var(--fc)}
.bwm-ml .ihtot small{font-size:10px;letter-spacing:.2em;color:var(--dim);text-transform:uppercase}
.bwm-ml .rtiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-top:18px}
.bwm-ml .rtile{--rc:#888;position:relative;padding:16px 16px 14px;background:linear-gradient(180deg,#171c24,#10141a);border:1px solid var(--line2);border-top:3px solid var(--rc)}
.bwm-ml .rtile .gem2{display:block;width:52px;height:52px;color:var(--rc);filter:drop-shadow(0 0 12px color-mix(in srgb,var(--rc) 50%,transparent))}
.bwm-ml .rtile .gem2 svg{width:52px;height:52px}
.bwm-ml .rtile .cnt{position:absolute;right:16px;top:14px;font-size:30px;font-weight:900}
.bwm-ml .rtile.zero .cnt{color:var(--dimmer)}
.bwm-ml .rtile .new{position:absolute;right:16px;top:52px;font-size:10px;font-weight:900;color:var(--cyan2);letter-spacing:.1em}
.bwm-ml .rtile b{display:block;font-size:16px;font-weight:900;margin-top:8px}
.bwm-ml .rtile small{font-size:10px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:var(--rc)}
.bwm-ml .rtile dl{display:grid;grid-template-columns:auto 1fr;gap:5px 10px;margin-top:12px;font-size:11.5px;color:#c3cdd8}
.bwm-ml .rtile dt{color:var(--dimmer);text-transform:uppercase;letter-spacing:.14em;font-size:9px;font-weight:800;padding-top:2px}
.bwm-ml .inote{margin-top:16px;font-size:12px;color:var(--dim);max-width:70ch}
@media (max-height:500px){.bwm-ml .ipane{padding:12px 16px}
.bwm-ml .ihead .pl{font-size:22px}
.bwm-ml .rtiles{grid-template-columns:repeat(auto-fill,minmax(180px,1fr));margin-top:10px}
.bwm-ml .rtile{padding:10px 12px}
.bwm-ml .rtile .gem2,.bwm-ml .rtile .gem2 svg{width:34px;height:34px}
.bwm-ml .rtile .cnt{font-size:22px}
.bwm-ml .rtile dl{display:none}
.bwm-ml .inote{display:none}}
@media (max-width:700px){.bwm-ml .inv .dp .ipane{padding:16px}
.bwm-ml .ihead .pl{font-size:24px}}
@media (min-width:981px),(max-height:500px) and (min-width:701px){.bwm-ml .inv .dp{overflow-y:auto}}
`;
