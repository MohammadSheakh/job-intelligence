export const FERIO_CSS = String.raw`
:root{
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  color:#111114;background:#ffffff;
  --ink:#111114;--muted:#6e6e73;--line:#e8e8ea;--surface:#fafafa;--paper:#ffffff;
  --success-bg:#edf7f0;--success:#24663a;--pending-bg:#fff6e6;--pending:#8a5a12;
  --error-bg:#fff0f1;--error:#9a3340;--neutral-bg:#f2f2f3;--neutral:#5f5f64;
  --radius:10px;
}
*{box-sizing:border-box}
html{background:var(--paper)}
body{margin:0;background:var(--paper);color:var(--ink);font-size:14px;line-height:1.5}
a{color:var(--ink);text-decoration:none}
a:hover{text-decoration:underline;text-underline-offset:3px}
h1,h2,h3,p{margin-top:0}
h1{font-size:30px;line-height:1.15;letter-spacing:-.025em;margin-bottom:7px;font-weight:700}
h2{font-size:17px;line-height:1.3;letter-spacing:-.01em;margin-bottom:10px;font-weight:650}
h3{font-size:14px;margin-bottom:8px;font-weight:650}
.muted{color:var(--muted)}
.micro{font-size:11px;line-height:1.35;text-transform:uppercase;letter-spacing:.075em;color:var(--muted);font-weight:650}
.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all}
.btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--ink);border-radius:999px;padding:8px 14px;background:var(--ink);color:#fff;font:inherit;font-weight:650;line-height:1.2;cursor:pointer;white-space:nowrap;transition:opacity .15s ease,background-color .15s ease,color .15s ease,border-color .15s ease}
.btn:hover{text-decoration:none;opacity:.84}
.btn:disabled{cursor:not-allowed;opacity:.32}
.btn.secondary{background:var(--paper);color:var(--ink);border-color:#cfcfd2}
.btn.ghost{background:transparent;color:var(--muted);border-color:transparent;padding-left:8px;padding-right:8px}
.btn.danger{background:var(--paper);color:var(--error);border-color:#e8c7cb}
.btn.success{background:var(--paper);color:var(--success);border-color:#cce0d2}
.input,select,textarea{width:100%;margin-top:5px;padding:9px 11px;border:1px solid #d6d6d9;border-radius:var(--radius);background:var(--paper);color:var(--ink);font:inherit;outline:none;transition:border-color .15s ease}
.input:focus,select:focus,textarea:focus{border-color:#8e8e93}
textarea{resize:vertical;min-height:90px}
label{display:block;font-size:12px;color:var(--muted);font-weight:650}
.card{background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);padding:18px;box-shadow:none}
.surface{background:var(--surface);border-radius:var(--radius);padding:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
.metric{font-size:28px;line-height:1.1;font-weight:700;letter-spacing:-.025em;margin-top:5px}
.section{margin-top:28px}
.section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:11px}
.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.toolbar{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin:0 0 16px}
.toolbar .field{min-width:190px;flex:0 1 260px}
.table-wrap{border-top:1px solid var(--line);border-bottom:1px solid var(--line);overflow:auto;background:var(--paper)}
table,.table{border-collapse:collapse;width:100%;font-size:13px}
th,td,.table th,.table td{text-align:left;padding:11px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th,.table th{background:var(--paper);color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;white-space:nowrap}
tr:last-child td,.table tr:last-child td{border-bottom:0}
.status,.pill{display:inline-flex;align-items:center;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:650;background:var(--neutral-bg);color:var(--neutral);white-space:nowrap}
.status.success,.pill.ok{background:var(--success-bg);color:var(--success)}
.status.pending,.pill.warn{background:var(--pending-bg);color:var(--pending)}
.status.error,.pill.bad{background:var(--error-bg);color:var(--error)}
.notice{padding:11px 13px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);color:var(--ink);margin-bottom:14px}
.notice.success{background:var(--success-bg);border-color:#dcecdf;color:var(--success)}
.notice.pending{background:var(--pending-bg);border-color:#f0dfbc;color:var(--pending)}
.notice.error{background:var(--error-bg);border-color:#efd8db;color:var(--error)}
.chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.chip{display:inline-flex;align-items:center;border-radius:999px;padding:3px 7px;font-size:11px;background:var(--neutral-bg);color:var(--neutral);border:0}
.empty{padding:32px 8px;color:var(--muted);text-align:center}
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.wide{grid-column:1/-1}
.checkgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px}
.check,.checkbox{display:flex!important;align-items:flex-start;gap:8px;font-size:13px!important;color:var(--ink)!important;font-weight:500!important;border-bottom:1px solid var(--line);padding:8px 2px}
.check input,.checkbox input{width:auto;margin:3px 0 0}
.subhead{font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:var(--muted);margin:20px 0 6px}
.category-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.category-box{border-top:1px solid var(--line);padding:12px 0 0}
.check-list{display:flex;flex-wrap:wrap;gap:8px 14px}
.check-list label{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:500;color:var(--ink)}
.check-list input{width:auto;margin:0}
.pager{margin-top:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.score{font-size:20px;font-weight:700;letter-spacing:-.02em}
.divider{height:1px;background:var(--line);margin:20px 0}
.stack{display:grid;gap:10px}
.kv{display:grid;grid-template-columns:minmax(120px,.65fr) 1fr;gap:12px;padding:9px 0;border-bottom:1px solid var(--line)}
.kv:last-child{border-bottom:0}
.job-list{border-top:1px solid var(--line)}
.job-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;padding:17px 0;border-bottom:1px solid var(--line);align-items:start}
.job-title{font-size:16px;font-weight:650;letter-spacing:-.01em;margin-bottom:3px}
.job-meta{color:var(--muted);font-size:12px}
.job-reasons{margin-top:8px;color:var(--muted);font-size:12px}
.job-actions{display:flex;gap:7px;align-items:center;justify-content:flex-end;flex-wrap:wrap;max-width:360px}
.hero{padding:8px 0 6px}
.stat-line{display:flex;align-items:baseline;gap:7px}
.inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
@media(max-width:760px){
  body{font-size:13px}h1{font-size:26px}.form-grid{grid-template-columns:1fr}.job-row{grid-template-columns:1fr}.job-actions{justify-content:flex-start;max-width:none}.kv{grid-template-columns:1fr;gap:2px}.toolbar .field{min-width:100%;flex-basis:100%}
}
`;
